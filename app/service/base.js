'use strict';

const Service = require('egg').Service;

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
            await app.redis.set('user_room_' + uid, room_name)
            //清除匹配信息
            await app.redis.del('group_room_' + uid)
            await app.redis.hdel('user_group_room', uid)
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
            let user_id = r[i].user_id
            let score = score_list[user_id] ? parseInt(score_list[user_id]) : 0
            data_r.push({ user_id, score })
            score_red += score
            await app.redis.del('user_room_' + user_id)
        }
        data_r.sort((a, b) => {
            return b.score - a.score
        })
        for (const i in b) {
            let user_id = r[i].user_id
            let score = score_list[user_id] ? parseInt(score_list[user_id]) : 0
            data_r.push({ user_id, score })
            score_red += score
            await app.redis.del('user_room_' + user_id)
        }
        data_b.sort((a, b) => {
            return b.score - a.score
        })
        return { data_r, data_b, score_red, score_blue }
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
