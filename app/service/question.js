'use strict';

const Service = require('./base');

/**
 * 出题模式
 */
class QuestionService extends Service {

    set_time = 15 //出题时间
    answer_time = 20 //答题时间
    round_count = 6 //轮次

    /**
     * 游戏开始
     * @param int id 选择的专业id
     * @param {*} red 红方
     * @param {*} blue 蓝放
     */
    async start(id, room_name, red, blue) {
        const { ctx, app } = this

        const { r, b } = await this.roomInit(red, blue, room_name)
        const list = await ctx.model.Subject.getAll(id, 4);
        //随机答题方
        const write = await this.random(room_name)

        this.send(r, 'group_set_start', { list, r, b, write, time: this.set_time })
        this.send(b, 'group_set_start', { list, r, b, write, time: this.set_time })

        await app.redis.hmset('group_room_' + room_name, {
            round: 1,
            write
        })

        //游戏开始，进入准备阶段
        app.queue_group_set_choice.push({ list, room_name, r, b, time: this.ready_time + 3 }, function (err) {
            console.log('finished processing foo');
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
        const list = await ctx.model.Subject.getAll(id, 4);
        const write = room_info.write == 'red' ? 'blue' : 'red'
        await app.redis.hmset('group_room_' + room_name, {
            round: room_info.round + 1,
            write
        })
        this.send(r, 'group_set_choice', { list, r, b, write, time: this.set_time })
        this.send(b, 'group_set_choice', { list, r, b, write, time: this.set_time })

        //游戏开始，进入准备阶段
        app.queue_group_set_choice.push({ list, room_name, r, b, time: this.ready_time }, function (err) {
            console.log('finished processing foo');
        });
    }

    /**
     * 答题
     */
    async answer(list, room_name, r, b) {

    }

    /**
     * 计算选题结果
     */
    async choiceDo(choince) {
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
                        if (c[element] ) {
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
    async end() {

    }
}

module.exports = QuestionService;
