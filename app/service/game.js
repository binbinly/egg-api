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
        //已推题目
        const already_list = [subject]
        //生成房间
        await app.redis.hmset('room_' + room_name, { user_ids: room_name, curr_subject_id: subject.id, list: JSON.stringify(list), already_list:JSON.stringify(already_list) })
        await app.redis.expire('room_' + room_name, 1800)
        user_ids.forEach(async uid => {
            //记录用户开始游戏，所在房间
            await app.redis.setex('user_room_' + uid, 1800, room_name)
            await app.redis.del('user_one_room_' + uid)
            //推送游戏开始消息
            ctx.send(uid, 'game_start', { subject, time: this.answer_time })
        });
        //游戏开始，开始一题一体推送
        app.queue_game_run.push({ subject, room_name, user_ids, time: this.answer_time + 3 }, function (err) {
            err && console.log(err)
        });
        //当前专业开始，清除当前专业匹配人信息
        await app.redis.del('game_major_' + major_id)
    }

    /**
     * 不满人数停止
     */
    async gameStop(major_id) {
        const { ctx, app } = this;

        //推送消息
        const users = await app.redis.smembers('game_major_' + major_id)
        users.forEach(u => {
            const user_info = JSON.parse(u)
            ctx.send(user_info.user_id, 'room_out', { user_id: user_info.user_id })
        });
        //当前专业开始，清除当前专业匹配人信息
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
        const already_list = JSON.parse(room_info.already_list)
        //检测是否还有下一题
        const subject = list.pop()
        if (subject) {
            already_list.push(subject)
            //推题目消息
            user_ids.forEach(async user_id => {
                await app.redis.hmset('room_' + room_name, { curr_subject_id: subject['id'], list: JSON.stringify(list), already_list:JSON.stringify(already_list) })
                ctx.send(user_id, 'game_next', { subject, time: this.answer_time })
            });
            //定时器
            app.queue_game_run.push({ subject, room_name, user_ids, time: this.answer_time }, function (err) {
                err && console.log(err)
            });
        } else {//题目已推完，游戏结束
            this.end(room_name, user_ids)
        }
    }

    /**
     * 游戏结束
     * @param {*} room_name 
     */
    async end(room_name, user_ids) {
        const { app, ctx } = this;

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
        //分排序
        data.sort((a, b) => {
            return b.score - a.score
        })
        
        user_ids.forEach(async uid => {
            //清除用户对应房间信息
            await app.redis.del('user_room_' + uid)
            //发送游戏结束消息
            ctx.send(uid, 'game_end', data)
        });
    }
}

module.exports = GameService;
