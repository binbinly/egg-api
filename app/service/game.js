'use strict';

const Service = require('egg').Service;

class GameService extends Service {

    /**
     * 游戏开始
     * @param {*} major_id 
     * @param {*} id 
     */
    async gameStart(major_id, id, speed) {
        const { ctx, app } = this;
        
        if (app.major[major_id] == 'quick') {
            app.major[major_id] = 'end'
            console.log('end')
            return
        }
        app.major[major_id] = speed
        const users = await app.redis.smembers('game_major_' + major_id)
        const user_ids = users.map(val => {
            const info = JSON.parse(val)
            return info.user_id
        })
        //题目列表
        const list = await ctx.model.Subject.getAll(id, 5);
        const first_subject = list.pop();
        const room_name = user_ids.join('_');
        let subject_ids = [first_subject.id]
        //题放入队列
        list.forEach(async val => {
            subject_ids.push(val.id)
            await app.redis.lpush('major_subject_' + room_name, JSON.stringify(val));
        });
        //生成房间
        await app.redis.set('room_' + room_name, JSON.stringify({ user_ids, subject_ids }))

        user_ids.forEach(async uid => {
            let ws = app.ws.user[uid] ? app.ws.user[uid] : null
            await app.redis.set('user_room_' + uid, room_name)
            if (ws) {
                ws.send(JSON.stringify({ cmd: 'game_start', data: first_subject }))
            }
        });
        //游戏开始，开始一题一体推送
        app.queue_game_run.push({ room_name, user_ids }, function (err) {
            console.log('finished processing foo');
        });
        await app.redis.del('game_major_' + major_id)
    }

    /**
     * push下一题
     * @param {*} room_name 
     */
    async nextSubject(room_name, user_ids) {
        const { app } = this;
        const subject = await app.redis.rpop('major_subject_' + room_name)
        if (subject) {
            console.log('user_ids', user_ids)
            user_ids.forEach(async user_id => {
                let ws = app.ws.user[user_id] ? app.ws.user[user_id] : null
                if (ws) {
                    ws.send(JSON.stringify({ cmd: 'game_next', data: subject }))
                }
            });
            app.queue_game_run.push({ room_name, user_ids }, function (err) {
                console.log('finished processing foo');
            });
        } else {//没有题了，游戏结束
            this.gameEnd(room_name, user_ids)
        }
    }

    /**
     * 游戏结束
     * @param {*} room_name 
     */
    async gameEnd(room_name, user_ids) {
        const { app } = this;
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
            let ws = app.ws.user[uid] ? app.ws.user[uid] : null
            if (ws) {
                ws.send(JSON.stringify({ cmd: 'game_end', data }))
            }
        });
    }
}

module.exports = GameService;
