'use strict';

const Service = require('./base');

/**
 * 出题模式
 */
class QuestionService extends Service {

    set_time = 10 //出题时间
    answer_time = 10 //答题时间
    round_count = 4 //轮次

    /**
     * 游戏开始
     * @param int id 选择的专业id
     * @param {*} red 红方
     * @param {*} blue 蓝放
     */
    async start(id, room_name, red, blue) {
        const { ctx, app } = this

        //上一局结束消息
        this.send(red, 'game_curr_end')
        this.send(blue, 'game_curr_end')

        const { r, b } = await this.roomInit(red, blue, room_name)
        const list = await ctx.model.Subject.getAll(id, 4);
        const ids = list.map(v => {
            return v.id
        })
        //随机答题方
        const write = await this.random(room_name)

        this.send(r, 'group_set_start', { list, r, b, write, time: this.set_time })
        this.send(b, 'group_set_start', { list, r, b, write, time: this.set_time })

        await app.redis.hmset('group_room_' + room_name, {
            round: 1,
            write,
            id,
            ids: ids.join('_')
        })

        //游戏开始，进入准备阶段
        app.queue_group_set_choice.push({ list, room_name, r, b, time: this.set_time + 3 }, function (err) {
            err && console.log(err)
        });
    }

    /**
     * 选题
     */
    async choice(room_name, r, b) {
        const { ctx, app } = this

        const room_info = await app.redis.hgetall('group_room_' + room_name)
        if (room_info.round >= this.round_count) {
            return this.end(room_name, r, b)
        }
        const list = await ctx.model.Subject.getAll(room_info.id, 4);
        const ids = list.map(v => {
            return v.id
        })
        const write = room_info.write == 'red' ? 'blue' : 'red'
        const round = parseInt(room_info.round) + 1
        await app.redis.hmset('group_room_' + room_name, {
            round,
            write,
            ids: ids.join('_'),
            status: 1
        })
        if (room_info.choice) {
            await app.redis.hdel('group_room_' + room_name, 'choice', 'choice_id')
        }
        this.send(r, 'group_set_choice', { list, write, time: this.set_time })
        this.send(b, 'group_set_choice', { list, write, time: this.set_time })

        //游戏开始，进入准备阶段
        app.queue_group_set_choice.push({ room_name, r, b, time: this.set_time }, function (err) {
            err && console.log(err)
        });
    }

    /**
     * 推送答题题目
     */
    async push(room_name, r, b) {
        const { app } = this;
        let room_info = await app.redis.hgetall('group_room_' + room_name)
        let choice_id = room_info.choice_id
        if (!choice_id) {//三个人，没有全选
            if (room_info.choice) {
                choice_id = this.choiceDo(JSON.parse(room_info.choice))
            } else {//无人选，系统自动选题
                const ids = room_info.ids.split('_')
                choice_id = ids[Math.floor(Math.random() * ids.length)]
            }
        }
        choice_id = parseInt(choice_id)
        await app.redis.hmset('group_room_' + room_name, { status: 2, curr_subject_id: choice_id })
        //出题方，答题方相反
        const write = room_info.write == 'red' ? 'blue' : 'red'
        this.send(r, 'group_set_next', { choice_id, time: this.answer_time, write })
        this.send(b, 'group_set_next', { choice_id, time: this.answer_time, write })

        app.queue_group_set_answer.push({ round: room_info.round, room_name, r, b, time: this.answer_time }, function (err) {
            err && console.log(err)
        });
    }

    /**
     * 从已选题中选择一道题
     */
    choiceDo(choince) {
        const ids = Object.values(choince)
        if (ids.length == 1) {//一个人选，直接返回该题
            return ids[0]
        } else if (ids.length == 2) {//两个人选，随机返回某题
            return ids[Math.floor(Math.random() * 2)]
        } else {//三人都选了
            const length = this.dedupe(ids).length
            if (length == 1) {
                return ids[0]
            } else if (length == 2) {//两个人选一样
                let c = []
                for (const key in ids) {
                    if (ids.hasOwnProperty(key)) {
                        const element = ids[key];
                        if (c[element]) {
                            c[element]++
                        } else {
                            c[element] = 1
                        }
                    }
                }
                for (const key in c) {
                    if (c.hasOwnProperty(key)) {
                        const element = c[key];
                        if (c[key] == 2) {
                            return key
                        }
                    }
                }
                return ids[0]
            } else {//三人选中都不一样
                return ids[Math.floor(Math.random() * 3)]
            }
        }
    }

    /**
     * 游戏结束
     */
    async end(room_name, r, b) {
        const { app } = this;
        console.log('game end')

        await app.redis.del('group_room_' + room_name)
        const data = await this.roomEnd(room_name, r, b)

        //发送消息
        this.send(r, 'group_set_end', data)
        this.send(b, 'group_set_end', data)
    }
}

module.exports = QuestionService;
