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

        if (curr_major_count == 0) {
            await app.redis.expire('game_major_' + major_id, 70)
            //push队列任务
            app.queue_game_in.push({ major_id, id }, function (err) {
                err && console.log(err)
            });
            return this.success([ctx.auth])
        } else {//发送消息给其他人
            const users = await app.redis.smembers('game_major_' + major_id)
            for (const key in users) {
                if (users.hasOwnProperty(key)) {
                    const u = JSON.parse(users[key]);
                    users[key] = u
                    if (user_id == u.user_id) continue
                    ctx.send(u.user_id, 'room_in', user)
                }
            }
            if (curr_major_count >= 5) {
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
        if (ret) {
            const user_ids = await app.redis.smembers('game_major_' + major_id)
            user_ids.forEach(async u => {
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
        });
        //专业id
        const { message } = ctx.request.body;
        const room_name = await app.redis.get('user_room_' + user_id)
        let user_ids_s = await app.redis.hget('room_' + room_name, 'user_ids')
        if (!user_ids_s) {
            user_ids_s = await app.redis.hget('group_room_' + room_name, 'user_ids')
        }
        if (user_ids_s) {
            const user_ids = user_ids_s.split('_')
            //发送消息
            user_ids.forEach(async uid => {
                if (user_id == uid) return
                ctx.send(uid, 'game_message', { user_id, message })
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
        console.log('room_info', room_info)
        if (room_info.user_ids) {
            const user_ids = room_info.user_ids.split('_')
            if (room_info.curr_subject_id != id) {
                return this.error(500, '题目非法')
            }
            console.log(user_ids)
            if (!user_ids.includes(user_id + '')) {
                return this.error(500, '不可以答题')
            }
            const subject_info = await ctx.model.Subject.getOne(id);
            if (!subject_info) {
                return this.error(500, '题目不存在')
            }

            let data = { user_id, option_id, id, score: 0, status: false }

            const subject_key = 'subject_' + id + '_' + room_name
            let rate = 1;
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
                if (len == user_ids.length) {
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
                data.status = true
                //计算分数
                data.score = parseInt((200 / 20 * (20 - second)) * rate)
            }
            //记录
            if (data.score > 0) {
                await app.redis.hincrby('answer_user_' + room_name, user_id, data.score)
            }
            //记录答题信息
            //await app.redis.hset('answer_history' + user_id, id, JSON.stringify({ option_id, second, status: data.status, score: data.score }))
            //发送消息
            user_ids.forEach(async uid => {
                if (user_id == uid) return
                ctx.send(uid, 'subject_finish', data)
            });
            if (quick) {
                //记录当前题已完成
                await app.redis.hset('room_' + room_name, id, 1)
                await ctx.service.game.nextSubject(room_name, user_ids)
            }
            this.success(data)
        } else {
            this.error(500, '房间信息错误')
        }
    }
}

module.exports = GameController;
