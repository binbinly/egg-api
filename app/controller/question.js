'use strict';

const Controller = require('./base');

/**
 * 出题模式
 */
class QuestionController extends Controller {

    /**
     * 选题
     */
    async choice() {
        const { ctx, app, service } = this;
        // 拿到当前用户id
        const user_id = ctx.auth.user_id
        ctx.validate({
            id: { type: 'int', required: true, min: 1 } //题目id
        })
        const { id } = ctx.request.body;
        //所在房间
        const room_name = await app.redis.get('user_room_' + user_id)
        if (!room_name) {
            return this.error(500, '不在房间内')
        }
        const room_info = await app.redis.hgetall('group_room_' + room_name)
        if (!room_info) {
            return this.error(500, '房间已解散')
        }
        const ids = room_info.ids.split('_')
        if (!ids.includes(id + '')) {
            return this.error(500, '错误选题')
        }
        if (room_info.status != 1) {
            return this.error(500, '选题已结束')
        }
        const cur_users = room_info.write == 'red' ? room_info.user_ids_r.split('_') : room_info.user_ids_b.split('_')
        if (!cur_users.includes(user_id + '')) {
            return this.error(500, '没有权限哦')
        }
        let choice = {}
        if (room_info.choice) {
            choice = JSON.parse(room_info.choice)
            if (choice[user_id]) {
                return this.error(500, '不可以重复选题')
            }
        }
        choice[user_id] = id
        //发送消息
        const red = JSON.parse(room_info.red)
        const blue = JSON.parse(room_info.blue)
        await service.question.send(red, 'group_choice_finish', { user_id, id })
        await service.question.send(blue, 'group_choice_finish', { user_id, id })
        if (Object.keys(choice).length == 3) {//三人都已经选择，计算选中题目
            const choice_id = service.question.choiceDo(choice)
            await service.question.send(red, 'group_choice_subject_finish', { choice_id })
            await service.question.send(blue, 'group_choice_subject_finish', { choice_id })
            await app.redis.hmset('group_room_' + room_name, { choice_id, choice: JSON.stringify(choice) })
        } else {
            await app.redis.hset('group_room_' + room_name, 'choice', JSON.stringify(choice))
        }

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
        const { id, option_id, second } = ctx.request.body;

        const room_name = await app.redis.get('user_room_' + user_id)
        const room_info = await app.redis.hgetall('group_room_' + room_name)
        console.log('room_info', room_info)
        if (room_info.user_ids) {
            const user_ids = room_info.user_ids.split('_')
            if (room_info.curr_subject_id != id) {
                return this.error(500, '答题超时')
            }
            //出题方 答题方相反
            const cur_user_ids = room_info.write == 'red' ? room_info.user_ids_b.split('_') : room_info.user_ids_r.split('_')
            if (!cur_user_ids.includes(user_id + '')) {
                return this.error(500, '不可以答题')
            }
            const subject_info = await ctx.model.Subject.getOne(id);
            if (!subject_info) {
                return this.error(500, '题目不存在')
            }
            let data = { user_id, option_id, id, score: 0, status: false }

            const subject_key = 'group_subject_' + id + '_' + room_name
            let quick = false
            if (await app.redis.exists(subject_key)) {
                if (await app.redis.hexists(subject_key, user_id)) {
                    return this.error(500, '不可重复答题')
                }
                await app.redis.hset(subject_key, user_id, 1)
                const len = await app.redis.hlen(subject_key)
                if (len == cur_user_ids.length) {
                    quick = true
                }
            } else {
                await app.redis.hset(subject_key, user_id, 1)
                await app.redis.expire(subject_key, 25)
            }

            if (subject_info.true_option == option_id) {//答题正确
                if (second >= 20) {
                    second = 19
                }
                data.status = true
                //计算分数
                data.score = parseInt(200 / 20 * (20 - second))
            }
            //记录
            if (data.score > 0) {
                await app.redis.hincrby('group_answer_user_' + room_name, user_id, data.score)
            }
            //记录答题信息
            //await app.redis.hset('answer_history' + user_id, id, JSON.stringify({ option_id, second, status: data.status, score: data.score }))
            //发送消息
            user_ids.forEach(async uid => {
                if (user_id == uid) return
                ctx.send(uid, 'group_set_subject_finish', data)
            });
            if (quick) {
                //记录当前题已完成
                const r = JSON.parse(room_info.red)
                const b = JSON.parse(room_info.blue)
                await app.redis.hset('group_room_' + room_name, 'round_' + room_info.round, 1)
                console.log('set round', room_info.round)
                await ctx.service.question.choice(room_name, r, b)
            }
            this.success(data)
        } else {
            this.error(500, '房间信息错误')
        }
    }
}

module.exports = QuestionController;
