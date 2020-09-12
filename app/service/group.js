'use strict';

const Service = require('egg').Service;

class GroupService extends Service {

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
        //生成房间 status 1=准备  2=抢 3=开始答题
        await app.redis.hmset('group_room_' + room_name, { status: 1, red: JSON.stringify(r), blue: JSON.stringify(b) })
        if (type == 1) {//抢题模式
            //题目列表
            const list = await ctx.model.Subject.getAll(id, 5);
            //题放入队列
            list.forEach(async val => {
                await app.redis.lpush('group_major_subject_' + room_name, JSON.stringify(val));
            });
        } else if (type == 2) {
            const list = await ctx.model.Subject.getAll(id, 4);
        } else {
            return false
        }
        this.send(r, room_name, 'group_start', { r, b, time: 5 })
        this.send(b, room_name, 'group_start', { r, b, time: 5 })
        //游戏开始，进入准备阶段
        app.queue_group_ready.push({ room_name, r, b, time: 5000 }, function (err) {
            console.log('finished processing foo');
        });
    }

    /**
     * 准备完成
     */
    async ready(room_name, r, b) {
        const { app } = this
        //判断是否还有题，无题了则结束游戏
        const len = await app.redis.llen('group_major_subject_' + room_name)
        if (len == 0) {
            return this.gameEnd(room_name, r, b)
        }
        this.send(r, room_name, 'group_ready', { time: 5 })
        this.send(b, room_name, 'group_ready', { time: 5 })
        //游戏开始，进入准备阶段
        app.queue_group_ready.push({ room_name, r, b, time: 5000 }, function (err) {
            console.log('finished processing foo');
        });
    }

    /**
     * 抢题
     */
    async rushAnswer(room_name, r, b) {
        const { app } = this
        this.send(r, room_name, 'group_rush', { time: 10 })
        this.send(b, room_name, 'group_rush', { time: 10 })
        //游戏开始，进入准备阶段
        app.queue_group_rush.push({ room_name, r, b, time: 10000 }, function (err) {
            console.log('finished processing foo');
        });
        //抢题中
        await app.redis.hset('group_room_' + room_name, 'status', 2)
    }

    //推题
    async nextSubject(room_name, r, b, speed) {
        const { app } = this;
        if (app.group_room[room_name] == 'quick') {
            app.group_room[room_name] = 'end'
            console.log('end')
            return
        }
        app.group_room[room_name] = speed
        const subject_str = await app.redis.rpop('group_major_subject_' + room_name)
        if (subject_str) {
            let subject = JSON.parse(subject_str)
            subject['time'] = 20
            this.send(r, room_name, 'group_next', subject)
            this.send(b, room_name, 'group_next', subject)
            //当前题
            await app.redis.hmset('group_room_' + room_name, { status: 3, curr_subject_id: subject['id'] })
            app.queue_group_run.push({ room_name, r, b, time: 20000 }, function (err) {
                console.log('finished processing foo');
            });
        }
    }

    async gameEnd(room_name, r, b) {
        const { app } = this
        const data = { 'defeat': 'r', 'win': 'b' }
        this.send(r, room_name, 'group_endt', data)
        this.send(b, room_name, 'group_end', data)
    }

    /**
     * 退消息
     * @param {*} list 
     * @param {*} room_name 
     */
    async send(list, room_name, cmd, data) {
        const { app, ctx } = this
        list.forEach(async v => {
            await app.redis.set('user_room_' + v.user_id, room_name)
            ctx.send(v.user_id, cmd, data)
        })
    }
}

module.exports = GroupService;
