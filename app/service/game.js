'use strict';

const Service = require('egg').Service;

/**
 * 个人赛
 */
class GameService extends Service {

    room_time = 60  //s, 房间等待时间
    answer_time = 10 //s, 答题时间
    subject_count = 5 //题目数量

    /**
     * 游戏开始
     * @param {*} major_id 
     * @param {*} id 
     */
    async gameStart(major_id, id) {
        const { ctx, app } = this;

        const users = await app.redis.smembers('game_major_' + major_id)
        const user_ids = users.map(val => {
            const info = JSON.parse(val)
            return info.user_id
        })
        //题目列表
        const list = await ctx.model.Subject.getAll(id, this.subject_count);
        const subject = list.pop();
        const room_name = user_ids.join('_');
        //生成房间
        await app.redis.hmset('room_' + room_name, { user_ids: room_name, curr_subject_id: subject.id, list:JSON.stringify(list) })
        await app.redis.expire('room_' + room_name, 1800)
        user_ids.forEach(async uid => {
            await app.redis.set('user_room_' + uid, room_name)
            ctx.send(uid, 'game_start', { subject, time: this.answer_time })
        });
        //游戏开始，开始一题一体推送
        app.queue_game_run.push({ subject, room_name, user_ids, time: this.answer_time + 3 }, function (err) {
            err && console.log(err)
        });
        await app.redis.del('game_major_' + major_id)
    }

    /**
     * 下一题
     * @param {*} room_name 
     * @param {*} user_ids 
     */
    async nextSubject(room_name, user_ids) {
        const { app, ctx } = this;
        const room_info = await app.redis.hgetall('room_' + room_name)
        const list = JSON.parse(room_info.list)
        //检测是否还有下一题
        const subject = list.pop()
        if (subject) {
            //推题目消息
            user_ids.forEach(async user_id => {
                await app.redis.hmset('room_' + room_name, {curr_subject_id: subject['id'], list:JSON.stringify(list)})
                ctx.send(user_id, 'game_next', { subject, time: this.answer_time })
            });
            //定时器
            app.queue_game_run.push({ subject, room_name, user_ids, time: this.answer_time }, function (err) {
                err && console.log(err)
            });
        } else {
            this.end(room_name, user_ids)
        }
    }

    /**
     * 游戏结束
     * @param {*} room_name 
     */
    async end(room_name, user_ids) {
        const { app, ctx } = this;
        console.log('game end')

        await app.redis.del('room_' + room_name)

        const score_list = await app.redis.hgetall('answer_user_' + room_name)
        await app.redis.del('answer_user_' + room_name)
        let data = []
        //计算分数
        for (const i in user_ids) {
            //结算
            let score = score_list[user_ids[i]] ? parseInt(score_list[user_ids[i]]) : 0
            data.push({ user_id: user_ids[i], score })
        }
        data.sort((a, b) => {
            return b.score - a.score
        })
        //发送消息
        user_ids.forEach(async uid => {
            await app.redis.del('user_room_' + uid)
            ctx.send(uid, 'game_end', data)
        });
    }
}

module.exports = GameService;
