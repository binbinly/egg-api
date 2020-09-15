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
     * 随机红/蓝方优先
     */
    async random(room_name) {
        const { app } = this
        const arr = ['red', 'blue']
        const write = arr[Math.floor((Math.random() * arr.length))]
        await app.redis.hset('group_room_' + room_name, 'cur_write', write)
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