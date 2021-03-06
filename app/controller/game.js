'use strict';

const Controller = require('./base');

/**
 * 个人赛
 */
class GameController extends Controller {

    /**
     * 进入单人游戏
     */
    async inGame() {
        const { ctx, app, service } = this;
        // 拿到当前用户id
        const user = ctx.auth
        const user_id = user.user_id
        const major_id = user.major_id
        // 验证参数
        ctx.validate({
            id: { type: 'int', required: true, min: 1 } //选择专业id
        });
        //专业id
        const { id } = ctx.request.body;

        //当前专业人数
        let curr_major_count = await app.redis.scard('game_major_' + major_id);

        const ret = await app.redis.sadd('game_major_' + major_id, JSON.stringify(user));
        if (!ret) {
            return this.error(500, '进入失败')
        }

        await app.redis.setex('user_one_room_' + user_id, 60, 1)
        if (curr_major_count == 0) {//第一个进入专业房间
            await app.redis.expire('game_major_' + major_id, 70)
            //延迟队列监听时间内是否可以开始游戏，或者解散
            app.queue_game_in.push({ major_id, id }, function (err) {
                err && console.log(err)
            });
            return this.success([ctx.auth])
        } else {
            //发送消息给当前专业房间内其他人
            const users = await app.redis.smembers('game_major_' + major_id)
            for (const key in users) {
                if (users.hasOwnProperty(key)) {
                    const u = JSON.parse(users[key]);
                    users[key] = u
                    if (user_id == u.user_id) continue
                    ctx.send(u.user_id, 'room_in', user)
                }
            }
            if (curr_major_count >= 5) {//当=6个人时，游戏开始
                //记录开始时间，防止延迟队列重复执行
                await app.redis.setex('start_major_' + major_id + '_' + id, 70, new Date().getTime())
                await service.game.gameStart(major_id, id);
            }
            return this.success(users)
        }
    }

    /**
     * 取消匹配
     */
    async outGame() {
        const { ctx, app } = this;
        // 拿到当前用户id
        const user_id = ctx.auth.user_id;
        const major_id = ctx.auth.major_id;
        const ret = await app.redis.srem('game_major_' + major_id, JSON.stringify(ctx.auth))
        await app.redis.del('user_one_room_' + user_id)
        if (ret) {
            //发送消息给房间内其他人
            const users = await app.redis.smembers('game_major_' + major_id)
            users.forEach(u => {
                const user_info = JSON.parse(u)
                ctx.send(user_info.user_id, 'room_out', { user_id })
            });
            return this.success()
        }
        this.error(500, '退出失败')
    }

    /**
     * 发送聊天消息
     */
    async message() {
        const { ctx, app } = this;
        // 拿到当前用户id
        const user_id = ctx.auth.user_id;
        // 验证参数
        ctx.validate({
            message: { type: 'string', required: true },
            type: { type: 'int', required: false },
        });
        //专业id
        const { message, type } = ctx.request.body;
        const room_name = await app.redis.get('user_room_' + user_id)
        //个人赛房间
        let user_ids_s = await app.redis.hget('room_' + room_name, 'user_ids')
        if (!user_ids_s) {//是否在团队赛房间
            user_ids_s = await app.redis.hget('group_room_' + room_name, 'user_ids')
        }
        if (user_ids_s) {
            const user_ids = user_ids_s.split('_')
            //发送消息
            user_ids.forEach(async uid => {
                if (user_id == uid) return
                ctx.send(uid, 'game_message', { user_id, message, type })
            });
            return this.success()
        }
        this.error(500, '发送失败')
    }

    /**
     * 答题
     */
    async answer() {
        const { ctx, app } = this;
        // 拿到当前用户id
        const user_id = ctx.auth.user_id;
        // 验证参数
        ctx.validate({
            id: { type: 'int', required: true, min: 1 },    //题目id
            option_id: { type: 'int', required: true, min: 1 }, //选择选项
            second: { type: 'int', required: true, min: 1 } //答题用时
        });
        //专业id
        const { id, option_id, second } = ctx.request.body;

        const room_name = await app.redis.get('user_room_' + user_id)
        const room_info = await app.redis.hgetall('room_' + room_name)
        if (room_info.user_ids) {
            const user_ids = room_info.user_ids.split('_')
            if (room_info.curr_subject_id != id) {
                return this.error(500, '题目非法')
            }
            if (!user_ids.includes(user_id + '')) {//非房间内人不可以答题
                return this.error(500, '不可以答题')
            }
            //获取题目详情
            const subject_info = await ctx.model.Subject.getOne(id);
            if (!subject_info) {
                return this.error(500, '题目不存在')
            }

            //发送至客户端消息格式
            let data = { user_id, option_id, id, score: 0, status: false }

            //存放答题情况
            const subject_key = 'subject_' + id + '_' + room_name
            let rate = 1;
            //是否都已经打完题，快速下一题
            let quick = false
            if (await app.redis.exists(subject_key)) {
                if (await app.redis.hexists(subject_key, user_id)) {
                    return this.error(500, '不可重复答题')
                }
                await app.redis.hset(subject_key, user_id, 1)
                const len = await app.redis.hlen(subject_key)

                if (len == 2) {//第二名
                    rate = 1.3
                } else if (len == 3) {//第三名
                    rate = 1.1
                }
                if (len == user_ids.length) {//所有人都已经答完题
                    quick = true
                }
            } else {//第一名
                await app.redis.hset(subject_key, user_id, 1)
                await app.redis.expire(subject_key, 25)
                rate = 1.5
            }

            if (subject_info.true_option == option_id) {//答题正确
                if (second >= 20) {
                    second = 19
                }
                //答题正确标识
                data.status = true
                //计算分数
                data.score = parseInt((200 / 20 * (20 - second)) * rate)
            }
            //记录个人当前局总分
            if (data.score > 0) {
                await app.redis.hincrby('answer_user_' + room_name, user_id, data.score)
            }
            //写入答题日志
            await this.app.model.AnswerLog.create({
                user_id,
                subject_id: id,
                type: 1,
                option_id,
                room_name,
                score: data.score,
                status: parseInt(data.status)
            });
            //发送消息
            user_ids.forEach(uid => {
                //自己不用发送
                if (user_id == uid) return
                ctx.send(uid, 'subject_finish', data)
            });
            if (quick) {//快速下一题
                //记录当前题已完成,防止延迟队列重复操作
                await app.redis.hset('room_' + room_name, id, 1)
                //开始下一题
                await ctx.service.game.nextSubject(room_name, user_ids)
            }
            this.success(data)
        } else {
            this.error(500, '房间信息错误')
        }
    }

    /**
     * 断线重连-房间信息
     */
    async roomInfo() {
        const {ctx, service} = this
        // 拿到当前用户id
        const user_id = ctx.auth.user_id;
        const data = await service.game.userRoomInfo(user_id)
        if (data == false) {
            this.error(500, '房间已解散')
        } else {
            this.success(data)
        }
    }
}

module.exports = GameController;
