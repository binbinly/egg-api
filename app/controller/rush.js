'use strict';

const Controller = require('./base');

/**
 * 抢题模式
 */
class RushController extends Controller {

    /**
     * 抢题
     */
    async rush() {
        const { ctx, app, service } = this;
        // 拿到当前用户id
        const user_id = ctx.auth.user_id
        ctx.validate({
            second: { type: 'int', required: true, min: 1 }
        })
        const { second } = ctx.request.body;
        //所在房间
        const room_name = await app.redis.get('user_room_' + user_id)
        if (!room_name) {
            return this.error(500, '不在房间内')
        }
        const list = await app.redis.hgetall('group_room_' + room_name)
        console.log(list)
        if (!list) {
            return this.error(500, '信息错误')
        }
        if (list.status != 2) {
            return this.error(500, '抢题已过时间哦')
        }
        if (list.user_id) {
            return this.error(500, '已被抢哦')
        }
        const red = JSON.parse(list.red)
        let write = '';
        red.forEach(v => {
            if (v.user_id == user_id) {
                write = 'red'
            }
        })
        const blue = JSON.parse(list.blue)
        blue.forEach(v => {
            if (v.user_id == user_id) {
                write = 'blue'
            }
        })
        if (write == '') {
            return this.error(500, '不在房间内哦')
        }
        const score = 50
        //记录抢题
        await app.redis.hmset('group_room_' + room_name, { user_id, write, rush: write })
        await app.redis.hincrby('group_room_' + room_name, write + '_score', score)
        await service.group.send(red, 'group_rush_finish', { user_id, write })
        await service.group.send(blue, 'group_rush_finish', { user_id, write })
        return this.success()
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
        let { id, option_id, second } = ctx.request.body;

        const room_name = await app.redis.get('user_room_' + user_id)
        const room_info = await app.redis.hgetall('group_room_' + room_name)
        console.log('room_info', room_info)
        if (room_info.user_ids) {
            const user_ids = room_info.user_ids.split('_')
            if (room_info.curr_subject_id != id) {
                return this.error(500, '题目非法')
            }
            const subject_info = await ctx.model.Subject.getOne(id);
            if (!subject_info) {
                return this.error(500, '题目不存在')
            }
            const cur_user_ids = room_info.write == 'red' ? room_info.user_ids_r.split('_') : room_info.user_ids_b.split('_')
            if (!cur_user_ids.includes(user_id + '')) {
                return this.error(500, '不可以答题')
            }
            let data = { user_id, option_id, id, score: 0, status: false }

            if (subject_info.true_option == option_id) {//答题正确
                if (second >= 20) {
                    second = 19
                }
                data.status = true
                //计算分数
                data.score = parseInt(200 / 20 * (20 - second))
                //记录题目回答正确id
                await app.redis.setex('group_answer_subject_' + id, 60, user_id)
            }

            const subject_key = 'group_subject_' + id + '_' + room_info.write + '_' + room_name
            let quick = 0
            if (await app.redis.exists(subject_key)) {
                if (await app.redis.hexists(subject_key, user_id)) {
                    return this.error(500, '不可重复答题')
                }
                await app.redis.hset(subject_key, user_id, data.status)
                const len = await app.redis.hlen(subject_key)

                if (len == cur_user_ids.length) {
                    if (await app.redis.exists('group_answer_subject_' + id)) {//有人回答正确
                        //直接进入下一题
                        quick = 2
                    } else {//切换答题方
                        quick = 1
                    }
                }
            } else {
                await app.redis.hset(subject_key, user_id, 1)
                await app.redis.expire(subject_key, 25)
            }

            //记录
            await app.redis.hincrby('group_answer_user_' + room_name, user_id, data.score)

            //发送消息
            user_ids.forEach(async uid => {
                if (user_id == uid) return
                ctx.send(uid, 'group_subject_finish', data)
            });
            if (quick == 2) {
                await app.redis.hset('group_room_' + room_name, id, 2)
                await ctx.service.group.ready(room_name, r, b)
            } else if (quick == 1) {
                await app.redis.hset('group_room_' + room_name, id, 1)
                await ctx.service.group.switch(id, room_name, r, b)
            }
            this.success(data)
        } else {
            this.error(500, '房间信息错误')
        }
    }
}

module.exports = RushController;
