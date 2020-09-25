'use strict';

const Service = require('egg').Service;

/**
 * 基类
 */
class BaseService extends Service {

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

    /**
     * 房间初始化
     * @param {*} red 
     * @param {*} blue 
     */
    async roomInit(red, blue, room_name) {
        const { app } = this
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
            status: 1,
            red: JSON.stringify(r),
            blue: JSON.stringify(b),
            user_ids: user_ids.join('_'),
            user_ids_r: user_ids_r.join('_'),
            user_ids_b: user_ids_b.join('_')
        })
        await app.redis.expire('group_room_' + room_name, 1800)
        //记录所在房间
        user_ids.forEach(async uid => {
            await app.redis.setex('user_room_' + uid, 1800, room_name)
            //清除匹配信息
            await app.redis.hdel('group_match_list', 'user_group_' + uid)
        });
        return { r, b }
    }

    /**
     * 房间销毁，统计分数
     * @param {*} room_name 
     * @param {*} r 
     * @param {*} b 
     */
    async roomEnd(room_name, r, b) {
        const { app } = this
        let data_r = []
        let data_b = []
        //结算
        const score_list = await app.redis.hgetall('group_answer_user_' + room_name)
        await app.redis.del('group_answer_user_' + room_name)
        let score_red = score_list['red'] ? parseInt(score_list['red']) : 0
        let score_blue = score_list['blue'] ? parseInt(score_list['blue']) : 0
        //计算分数
        for (const i in r) {
            const user_id = r[i].user_id
            const score = score_list[user_id] ? parseInt(score_list[user_id]) : 0
            data_r.push({ user_id, score })
            score_red += score
            await this.roomStatusSave(user_id)
        }
        data_r.sort((a, b) => {
            return b.score - a.score
        })
        for (const i in b) {
            const user_id = b[i].user_id
            const score = score_list[user_id] ? parseInt(score_list[user_id]) : 0
            data_b.push({ user_id, score })
            score_blue += score
            await this.roomStatusSave(user_id)
        }
        data_b.sort((a, b) => {
            return b.score - a.score
        })
        const win = this.getWin(score_red, score_blue)
        return { data_r, data_b, score_red, score_blue, win }
    }

    /**
     * 获取赢方
     * @param {*} score_red 
     * @param {*} score_blue 
     */
    getWin(score_red, score_blue) {
        if (score_blue == score_red) {
            const arr = ['red', 'blue']
            return arr[Math.floor((Math.random() * arr.length))]
        }
        return score_red > score_blue ? 'red' : 'blue'
    }

    /**
     * 临时保持房间状态，方便下一局
     * @param {*} user_id 
     */
    async roomStatusSave(user_id) {
        const { app } = this
        console.log('user_id', user_id)
        await app.redis.del('user_room_' + user_id)
        if (await app.redis.exists('user_group_' + user_id)) {
            await app.redis.rename('user_group_' + user_id, 'old_user_group_' + user_id)
        }
        if (await app.redis.exists('user_group_room_' + user_id)) {
            await app.redis.rename('user_group_room_' + user_id, 'old_user_group_room_' + user_id)
        }
    }

    /**
     * 随机红/蓝方优先
     */
    async random(room_name) {
        const { app } = this
        const arr = ['red', 'blue']
        const write = arr[Math.floor((Math.random() * arr.length))]
        await app.redis.hmset('group_room_' + room_name, 'write', write)
        return write
    }

    /**
     * 数组去重
     * @param {*} arr 
     */
    dedupe(arr) {
        var newSet = new Set(arr);  // arr变成了set的数据结构，并去除了其中重复的元素
        return Array.from(newSet);  // Array.from方法将set数据结构转为数组数据结构
    }
}

module.exports = BaseService;
