'use strict';

const Service = require('egg').Service;

class GroupService extends Service {

    ready_time = 5  //准备时间
    rush_time = 5   //抢题时间
    answer_time = 20    //答题时间

    /**
     * 游戏开始
     * @param {*} key 
     * @param {*} red 
     * @param {*} blue 
     */
    async gameStart(key, red, blue) {
        const { ctx, app } = this
        const arr = key.split('_')
        const type = arr[1]
        const id = arr[2]
        const room_name = key + '_' + (new Date().getTime())
        const r = red.map(v => {
            return JSON.parse(v)
        })
        const b = blue.map(v => {
            return JSON.parse(v)
        })
        let user_ids_r = r.map(v => {
            return v.user_id
        })
        let user_ids_b = b.map(v => {
            return v.user_id
        })
        const user_ids = user_ids_r.concat(user_ids_b)
        //生成房间 status 1=准备  2=抢 3=开始答题
        await app.redis.hmset('group_room_' + room_name, {
            status: 1, red: JSON.stringify(r),
            blue: JSON.stringify(b), user_ids: user_ids.join('_'),
            user_ids_r: user_ids_r.join('_'), user_ids_b: user_ids_b.join('_')
        })
        let subject = null
        if (type == 1) {//抢题模式
            //题目列表
            const list = await ctx.model.Subject.getAll(id, 5);
            subject = list.pop()
            //题放入队列
            list.forEach(async val => {
                await app.redis.lpush('group_major_subject_' + room_name, JSON.stringify(val));
            });
        } else if (type == 2) {
            const list = await ctx.model.Subject.getAll(id, 4);
        } else {
            return false
        }
        this.send(r, 'group_start', { r, b, time: 5 })
        this.send(b, 'group_start', { r, b, time: 5 })
        //记录所在房间
        user_ids.forEach(async uid => {
            await app.redis.set('user_room_' + uid, room_name)
            await app.redis.del('group_room_' + uid)
            await app.redis.hdel('user_group_room', uid)
        });
        //游戏开始，进入准备阶段
        app.queue_group_ready.push({ subject, room_name, r, b, time: this.ready_time }, function (err) {
            console.log('finished processing foo');
        });
    }

    /**
     * 准备完成
     */
    async ready(room_name, r, b) {
        const { app } = this
        const subject_str = await app.redis.rpop('group_major_subject_' + room_name)
        if (subject_str) {
            let subject = JSON.parse(subject_str)
            await app.redis.hdel('group_room_' + room_name, 'user_id', 'cur_write', 'write')
            this.send(r, 'group_ready', { time: this.ready_time })
            this.send(b, 'group_ready', { time: this.ready_time })
            //游戏开始，进入准备阶段
            app.queue_group_ready.push({ subject, room_name, r, b, time: this.ready_time }, function (err) {
                console.log('finished processing foo');
            });
        } else {
            this.gameEnd(room_name, r, b)
        }
    }

    /**
     * 抢题
     */
    async rushAnswer(subject, room_name, r, b) {
        const { app } = this

        this.send(r, 'group_rush', { time: this.rush_time })
        this.send(b, 'group_rush', { time: this.rush_time })
        //游戏开始，进入准备阶段
        app.queue_group_rush.push({ subject, room_name, r, b, time: this.rush_time }, function (err) {
            console.log('finished processing foo');
        });
        //抢题中
        await app.redis.hset('group_room_' + room_name, 'status', 2)
    }

    /**
     * 切换答题方
     * @param {*} room_name 
     * @param {*} r 
     * @param {*} b 
     */
    async switchGroup(subject, room_name, r, b) {
        const { app } = this
        if (await app.redis.exists('group_answer_subject_' + subject['id'])) {//有人回答正确，不用切换答题方
            //可以直接进入下一题
            this.nextSubject(room_name, r, b)
            return
        }
        const room_info = await app.redis.hgetall('group_room_' + room_name)
        const write = room_info.cur_write == 'red' ? 'blue' : 'red'
        await app.redis.hmset('group_room_' + room_name, { cur_write: write })
        this.send(r, 'group_switch', { write, time: this.answer_time })
        this.send(b, 'group_switch', { write, time: this.answer_time })
    }

    //推题
    async pushSubject(subject, room_name, r, b) {
        const { app } = this;
        let write = await app.redis.hget('group_room_' + room_name, 'cur_write')
        if (!write) {
            const arr = ['red', 'blue']
            write = arr[Math.floor((Math.random() * arr.length))]
            await app.redis.hset('group_room_' + room_name, 'cur_write', write)
        }
        this.send(r, 'group_next', { subject, time: 10, write })
        this.send(b, 'group_next', { subject, time: 10, write })
        //当前题
        await app.redis.hmset('group_room_' + room_name, { status: 3, curr_subject_id: subject['id'] })
        app.queue_group_run.push({ subject, room_name, r, b, time: this.answer_time }, function (err) {
            console.log('finished processing foo');
        });
    }

    /**
     * 游戏结束
     * @param {*} room_name 
     * @param {*} r 
     * @param {*} b 
     */
    async gameEnd(room_name, r, b) {
        const { app, ctx } = this;
        console.log('game end')

        await app.redis.del('group_major_subject_' + room_name)
        await app.redis.del('group_room_' + room_name)
        let data_r = []
        let data_b = []
        //结算
        const score_list = await app.redis.hgetall('group_answer_user_' + room_name)
        await app.redis.del('group_answer_user_' + room_name)
        //计算分数
        for (const i in r) {
            let score = 0
            score += parseInt(score_list[r[i].user_id]);
            data_r.push({ user_id: r[i].user_id, score })
            await app.redis.del('user_room_' + r[i].user_id)
        }
        data_r.sort((a, b) => {
            return b.score - a.score
        })
        for (const i in b) {
            let score = 0
            score += parseInt(score_list[b[i].user_id]);
            data_b.push({ user_id: b[i].user_id, score })
            await app.redis.del('user_room_' + b[i].user_id)
        }
        data_b.sort((a, b) => {
            return b.score - a.score
        })
        //发送消息
        this.send(r, 'group_end', {data_r, data_b})
        this.send(b, 'group_end', {data_r, data_b})
    }

    /**
     * 退消息
     * @param {*} list 
     * @param {*} room_name 
     */
    async send(list, cmd, data) {
        const { app, ctx } = this
        list.forEach(async v => {
            ctx.send(v.user_id, cmd, data)
        })
    }
}

module.exports = GroupService;
