'use strict';

const Controller = require('./base');

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
            id: { type: 'int', required: true }
        });
        //专业id
        const { id } = ctx.request.body;

        //当前专业人数
        let curr_major_count = await app.redis.scard('game_major_' + major_id);

        const ret = await app.redis.sadd('game_major_' + major_id, JSON.stringify(user));
        if (!ret) {
            return this.error(500, '进入失败')
        }

        console.log('count', curr_major_count)
        if (curr_major_count == 0) {
            await app.redis.expire('game_major_' + major_id, 60)
            //push队列任务
            app.queue_game_in.push({ major_id, id }, function (err) {
                console.log('finished processing foo');
            });
            return this.success([ctx.auth])
        } else {//发送消息给其他人
            const users = await app.redis.smembers('game_major_' + major_id)
            for (const key in users) {
                if (users.hasOwnProperty(key)) {
                    const u = JSON.parse(users[key]);
                    users[key] = u
                    if (user_id == u.user_id) continue
                    let ws = app.ws.user[u.user_id] ? app.ws.user[u.user_id] : null
                    if (ws) {
                        ws.send(JSON.stringify({ cmd: 'room_in', data: user }))
                    }
                }
            }
            if (curr_major_count >= 2) {
                await service.game.gameStart(major_id, id, 'quick');
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
                let ws = app.ws.user[user_info.user_id] ? app.ws.user[user_info.user_id] : null
                if (ws) {
                    ws.send(JSON.stringify({ cmd: 'room_out', data: { user_id } }))
                }
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
        const user_ids_str = await app.redis.get('room_' + room_name)
        if (user_ids_str) {
            const { user_ids } = JSON.parse(user_ids_str)
            //发送消息
            user_ids.forEach(async uid => {
                if (user_id == uid) return
                let ws = app.ws.user[uid] ? app.ws.user[uid] : null
                if (ws) {
                    ws.send(JSON.stringify({ cmd: 'game_message', data: { user_id, message } }))
                }
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
            id: { type: 'int', required: true },    //题目id
            option_id: { type: 'int', required: true }, //选择选项
            second: { type: 'int', required: true } //答题用时
        });
        //专业id
        const { id, option_id, second } = ctx.request.body;

        const room_name = await app.redis.get('user_room_' + user_id)
        const user_ids_str = await app.redis.get('room_' + room_name)
        if (user_ids_str) {
            const { user_ids, subject_ids } = JSON.parse(user_ids_str)
            if (subject_ids.indexOf(id) <= -1) {
                return this.error(500, '题目id非法')
            }
            const subject_info = await ctx.model.Subject.getOne(id);

            if (!subject_info) {
                return this.error(500, '题目不存在')
            }

            let data = { user_id }
            if (subject_info.true_option == option_id) {//答题正确
                data.status = true
                const subject_key = 'subject_' + id + '_' + room_name
                let rate = 1;
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
                } else {//第一名
                    await app.redis.hset(subject_key, user_id, 1)
                    await app.redis.expire(subject_key, 20)
                    rate = 1.5
                }

                //计算分数
                data.score = parseInt((200 / 20 * (20 - second)) * rate)
                //记录
                await app.redis.hset('answer_user_' + user_id, id, data.score)
            } else {
                data.status = false
            }
            //发送消息
            user_ids.forEach(async uid => {
                if (user_id == uid) return
                let ws = app.ws.user[uid] ? app.ws.user[uid] : null
                if (ws) {
                    ws.send(JSON.stringify({ cmd: 'subject_finish', data }))
                }
            });
            this.success(data)
        } else {
            this.error(500, '房间信息错误')
        }
    }
}

module.exports = GameController;
