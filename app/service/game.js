'use strict';

const { jsonp } = require('../../config/plugin');

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
        console.log('user_ids', user_ids)
        //题目列表
        const list = await ctx.model.Subject.getAll(id, 5);
        const first_subject = list.pop();
        const room_name = user_ids.join('_');
        //初始化
        app.room[room_name] = 'end'
        //题放入队列
        list.forEach(async val => {
            await app.redis.lpush('major_subject_' + room_name, JSON.stringify(val));
        });
        //生成房间
        await app.redis.hset('room_' + room_name, 'user_ids', room_name)

        user_ids.forEach(async uid => {
            if (app.ws.user[uid]) {
                await app.redis.set('user_room_' + uid, room_name)
                let subject = JSON.parse(JSON.stringify(first_subject))
                subject['time'] = 10
                //记录房间当前题
                await app.redis.hset('room_' + room_name, 'curr_subject_id', subject['id'])
                ctx.send(uid, 'game_start', subject)
            }
        });
        //游戏开始，开始一题一体推送
        app.queue_game_run.push({ room_name, user_ids, time: 13000 }, function (err) {
            console.log('finished processing foo');
        });
        await app.redis.del('game_major_' + major_id)
    }

    /**
     * push下一题
     * @param {*} room_name 
     */
    async nextSubject(room_name, user_ids, speed) {
        const { app, ctx } = this;
        if (app.room[room_name] == 'quick') {
            app.room[room_name] = 'end'
            console.log('end')
            return
        }
        app.room[room_name] = speed
        const subject_str = await app.redis.rpop('major_subject_' + room_name)
        if (subject_str) {
            let subject = JSON.parse(subject_str)
            console.log('user_ids', user_ids)
            user_ids.forEach(async user_id => {
                subject['time'] = 10
                await app.redis.hset('room_' + room_name, 'curr_subject_id', subject['id'])
                ctx.send(user_id, 'game_next', subject)
            });
            app.queue_game_run.push({ room_name, user_ids, time: 10000 }, function (err) {
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
