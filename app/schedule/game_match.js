const Subscription = require('egg').Subscription;

class GameMatch extends Subscription {
    // 通过 schedule 属性来设置定时任务的执行间隔等配置
    static get schedule() {
        return {
            interval: '1m', // 1 分钟间隔
            type: 'all', // 指定所有的 worker 都需要执行
        };
    }

    // subscribe 是真正定时任务执行时被运行的函数
    async subscribe() {
        const app = this.ctx.app
        return
        // const list = await app.redis.hgetall('group_match_list')
        const list = {
            group_room_1: '{"major_id":"1","id":1,"type":1, "count":3}',
            group_room_2: '{"major_id":"1","id":1,"type":1, "count":2}',
            group_room_3: '{"major_id":"1","id":1,"type":1, "count":1}',
            group_room_4: '{"major_id":"1","id":1,"type":1, "count":1}',
            group_room_5: '{"major_id":"1","id":1,"type":1, "count":2}',
            group_room_6: '{"major_id":"1","id":1,"type":1, "count":3}',
            group_room_7: '{"major_id":"2","id":1,"type":1, "count":3}',
            group_room_8: '{"major_id":"3","id":1,"type":1, "count":2}',
            group_room_9: '{"major_id":"2","id":1,"type":1, "count":1}',
            group_room_16: '{"major_id":"2","id":1,"type":1, "count":1}'
        }
        let data = {}
        for (const key in list) {
            if (list.hasOwnProperty(key)) {
                const element = JSON.parse(list[key]);
                const k = element.major_id + '_' + element.type + '_' + element.id
                if (data[k]) {
                    data[k].push(key)
                } else {
                    data[k] = [key]
                }
            }
        }
        console.log('data', data)
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const rooms = data[key];
                if (rooms.length < 2) return
                let red = await this.match(rooms)
                let blue = await this.match(rooms)
                console.log('red', red)
                console.log('blue', blue)
            }
        }
    }

    async match(room_names) {
        const app = this.ctx.app
        let user_list = []
        for (const room_name in room_names) {
            if (room_names.hasOwnProperty(room_name)) {
                const users = await app.redis.hgetall(room_name)
                let cur_users = Object.values(users)
                if (user_list.length == 0) {
                    user_list = cur_users
                } else if (user_list.length >= 3) {
                    return user_list
                } else {
                    const cur_length = Object.keys(users).length
                    if (blue_length + cur_length <= 3) {
                        user_list = [user_list, ...cur_users]
                    }
                }
            }
        }
    }
}

module.exports = GameMatch;