const Subscription = require('egg').Subscription;

/**
 * 定时任务 - 团队人员匹配
 */
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
        const list = await app.redis.hgetall('group_match_list')
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
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const rooms = data[key];
                if (rooms.length < 2) continue
                const { status, red, blue } = await this.match(rooms)
                if (status == true) {
                    const arr = key.split('_')
                    const type = arr[1]
                    const id = arr[2]
                    //生成房间
                    const new_room = key + '_' + parseInt(new Date().getTime()/1000)
                    if (type == 1) {//抢题模式
                        await this.ctx.service.group.start(id, new_room, red, blue)
                    } else if (type == 2) {
                        await this.ctx.service.question.start(id, new_room, red, blue)
                    } else {
                        console.log('type error', type)
                    }
                }
            }
        }
    }

    /**
     * 匹配
     * @param {*} room_names 
     */
    async match(room_names) {
        const app = this.ctx.app
        let red = []
        let blue = []
        for (const key in room_names) {
            if (room_names.hasOwnProperty(key)) {
                const room_name = room_names[key]
                let users = await app.redis.hgetall(room_name)
                if (Object.keys(users).length == 0) {//
                    await app.redis.hdel('group_match_list', room_name)
                    continue
                }
                delete users.id
                delete users.type
                let cur_users = Object.values(users)
                if (cur_users.length == 0) {
                    continue
                }
                if (red.length + cur_users.length <= 3) {
                    red = red.concat(cur_users)
                } else if (blue.length + cur_users.length <= 3) {
                    blue = blue.concat(cur_users)
                }
                if (red.length == 3 && blue.length == 3) {//匹配成功
                    return { status: true, red, blue }
                }
            }
        }
        return { status: false, red, blue }
    }
}

module.exports = GameMatch;