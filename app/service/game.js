'use strict';

const Service = require('egg').Service;

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
        //题放入队列
        list.forEach(async val => {
            await app.redis.lpush('major_subject_' + room_name, JSON.stringify(val));
        });
        //生成房间
        await app.redis.hmset('room_' + room_name, { user_ids: room_name, curr_subject_id: subject.id })

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
        //检测是否还有下一题
        const subject_str = await app.redis.rpop('major_subject_' + room_name)
        if (subject_str) {
            const subject = JSON.parse(subject_str)
            //推题目消息
            user_ids.forEach(async user_id => {
                await app.redis.hset('room_' + room_name, 'curr_subject_id', subject['id'])
                ctx.send(user_id, 'game_next', { subject, time: this.answer_time })
            });
            //定时器
            app.queue_game_run.push({ subject, room_name, user_ids, time: this.answer_time }, function (err) {
                err && console.log(err)
            });
        } else {
            this.gameEnd(room_name, user_ids)
        }
    }

    /**
     * 游戏结束
     * @param {*} room_name 
     */
    async gameEnd(room_name, user_ids) {
        const { app, ctx } = this;
        console.log('game end')

        await app.redis.del('major_subject_' + room_name)
        await app.redis.del('room_' + room_name)
        let data = []
        //计算分数
        for (const i in user_ids) {
            //结算
            const score_list = await app.redis.hgetall('answer_user_' + user_ids[i])
            await app.redis.del('answer_user_' + user_ids[i])
            let score = 0
            for (const key in score_list) {
                if (score_list.hasOwnProperty(key)) {
                    score += parseInt(score_list[key]);
                }
            }
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
