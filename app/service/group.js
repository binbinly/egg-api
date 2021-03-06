'use strict';

const Service = require('./base');

/**
 * 枪替模式
 */
class GroupService extends Service {

    ready_time = 1  //准备时间
    rush_time = 5   //抢题时间
    answer_time = 10    //答题时间

    /**
     * 游戏开始
     * @param {*} id 选择的专业id 
     * @param {*} red 
     * @param {*} blue 
     */
    async start(id, room_name, red, blue) {
        const { ctx, app } = this
        const { r, b } = await this.roomInit(red, blue, room_name)

        //题目列表
        const list = await ctx.model.Subject.getAll(id, 5);
        const subject = list.pop()
        this.send(r, 'group_start', { r, b, time: this.ready_time })
        this.send(b, 'group_start', { r, b, time: this.ready_time })

        //保存当局题
        await app.redis.hset('group_room_' + room_name, 'list', JSON.stringify(list))

        //游戏开始，进入准备阶段， 动画时间 3s
        app.queue_group_ready.push({ subject, room_name, r, b, time: this.ready_time + 3 }, function (err) {
            err && console.log(err)
        });
    }

    /**
     * 邀请超时
     * @param {*} user_id 
     * @param {*} id 
     */
    async inviteTimeout(user_id, id) {
        const {ctx, app} = this
        if (await app.redis.exists('invite_' + user_id + '_to_' + id)) {
            await app.redis.del('invite_' + user_id + '_to_' + id)
            ctx.send(user_id, 'invite_refuse', { user_id:id })
        }
    }

    /**
     * 准备开始
     */
    async ready(room_name, r, b) {
        const { app } = this
        const room_info = await app.redis.hgetall('group_room_' + room_name)
        const list = JSON.parse(room_info.list)
        //检测是否还有下一题
        const subject = list.pop()
        if (subject) {
            await app.redis.hdel('group_room_' + room_name, 'user_id', 'rush', 'write')
            await app.redis.hmset('group_room_' + room_name, { status: 1, list: JSON.stringify(list) })
            this.send(r, 'group_ready', { time: this.ready_time })
            this.send(b, 'group_ready', { time: this.ready_time })
            //游戏开始，进入准备阶段
            app.queue_group_ready.push({ subject, room_name, r, b, time: this.ready_time + 3 }, function (err) {
                err && console.log(err)
            });
        } else {
            this.end(room_name, r, b)
        }
    }

    /**
     * 抢题开始
     */
    async rushAnswer(subject, room_name, r, b) {
        const { app } = this

        this.send(r, 'group_rush', { time: this.rush_time })
        this.send(b, 'group_rush', { time: this.rush_time })
        //游戏开始，进入准备阶段
        app.queue_group_rush.push({ subject, room_name, r, b, time: this.rush_time }, function (err) {
            err && console.log(err)
        });
        //抢题中
        await app.redis.hset('group_room_' + room_name, 'status', 2)
    }

    /**
     * 推题，答题开始
     * @param {*} subject 
     * @param {*} room_name 
     * @param {*} r 
     * @param {*} b 
     */
    async pushSubject(subject, room_name, r, b) {
        const { app } = this;
        let write = await app.redis.hget('group_room_' + room_name, 'write')
        if (!write) {
            write = await this.random(room_name)
        }
        this.send(r, 'group_next', { subject, time: this.answer_time, write })
        this.send(b, 'group_next', { subject, time: this.answer_time, write })
        //当前题
        await app.redis.hmset('group_room_' + room_name, { status: 3, curr_subject_id: subject['id'] })
        app.queue_group_run.push({ subject, room_name, r, b, time: this.answer_time * 2 }, function (err) {
            err && console.log(err)
        });
    }

    /**
     * 切换答题方
     * @param {*} room_name 
     * @param {*} r 
     * @param {*} b 
     */
    async switch(id, room_name, r, b) {
        const { app } = this
        if (await app.redis.exists('group_answer_subject_' + id)) {//有人回答正确，不用切换答题方
            //可以直接进入下一题
            await app.redis.hset('group_room_' + room_name, id, 2)
            this.ready(room_name, r, b)
            return
        }
        let write = await app.redis.hget('group_room_' + room_name, 'write')
        write = write == 'red' ? 'blue' : 'red'
        await app.redis.hset('group_room_' + room_name, 'write', write)
        this.send(r, 'group_switch', { write, time: this.answer_time })
        this.send(b, 'group_switch', { write, time: this.answer_time })
    }

    /**
     * 游戏结束
     * @param {*} room_name 
     * @param {*} r 
     * @param {*} b 
     */
    async end(room_name, r, b) {
        const { app, ctx } = this;
        console.log('game end')
        await app.redis.del('group_room_' + room_name)

        const data = await this.roomEnd(room_name, r, b)
        //发送消息
        this.send(r, 'group_end', data)
        this.send(b, 'group_end', data)
    }

    /**
     * 用户房间信息
     */
    async userRoomInfo(user_id) {
        const { app } = this
        const room_name = await app.redis.get('user_room_' + user_id)
        const room_info = await app.redis.hgetall('group_room_' + room_name)
        if (room_info.user_ids) {
            let data = {}
            data.status = room_info.status
            // 答题数据
            data.answer = await app.model.AnswerLog.getAll(user_id, room_name)
            //当前题目id
            data.curr_subject_id = parseInt(room_info.curr_subject_id)
            //已经推的题目
            data.already_list = room_info.already_list ? JSON.parse(room_info.already_list) : []
            return data
        }
        return false
    }
}

module.exports = GroupService;
