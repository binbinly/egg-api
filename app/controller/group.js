'use strict';

const Controller = require('./base');

/**
 * 团队赛
 */
class GroupController extends Controller {

    /**
     * 进入游戏
     */
    async inGame() {
        const { ctx, app } = this;
        // 拿到当前用户id
        const user_id = ctx.auth.user_id
        await app.redis.hset('group_room_' + user_id, 'master', JSON.stringify(ctx.auth))
        await app.redis.hset('user_group_room', user_id, 'group_room_' + user_id)
        return this.success()
    }

    /**
     * 被邀请人退出房间
     */
    async outGame() {
        const { ctx, app } = this;
        // 拿到当前用户id
        const user_id = ctx.auth.user_id
        //所在房间
        const room_name = await app.redis.hget('user_group_room', user_id)
        if (!room_name) {
            return this.error(500, '未在房间内')
        }
        const list = await app.redis.hgetall(room_name)
        if (!list) {
            return this.error(500, '信息错误')
        }
        const user_count = Object.keys(list).length
        console.log('count', user_count)
        for (const key in list) {
            if (list.hasOwnProperty(key)) {
                const element = JSON.parse(list[key]);
                if (key == 'master' && element.user_id == user_id) {
                    let new_master = 0
                    if (user_count == 1) {//只有群主自己
                        await app.redis.del(room_name)
                        await app.redis.hdel('user_group_room', user_id)
                        return this.success()
                    } else if (user_count == 2) {//邀请了一个用户
                        if (list['slave1']) {
                            new_master = list['slave1']
                            await app.redis.hdel(room_name, 'slave1')
                        } else if (list['slave2']) {
                            new_master = list['slave2']
                            await app.redis.hdel(room_name, 'slave2')
                        }
                        if (new_master) {
                            await app.redis.hset(room_name, 'master', new_master)
                        }
                    } else if (user_count == 3) {//邀请了两个用户
                        new_master = list['slave1']
                        await app.redis.hdel(room_name, 'slave1')
                        await app.redis.hset(room_name, 'master', new_master)
                    }
                    //发送消息
                    new_master = JSON.parse(new_master)
                    this.sendRoomMsg(list, ['slave1', 'slave2'], 'group_room_out', { user_id, new_master: new_master.user_id })
                } else if (key == 'slave1' && element.user_id == user_id) {
                    const suc = await app.redis.hdel(room_name, 'slave1')
                    if (!suc) {
                        return this.error(500, '无需退出')
                    }
                    //发送消息
                    this.sendRoomMsg(list, ['master', 'slave2'], 'group_room_out', { user_id })
                } else if (key == 'slave2' && element.user_id == user_id) {
                    const suc = await app.redis.hdel(room_name, 'slave2')
                    if (!suc) {
                        return this.error(500, '无需退出')
                    }
                    //发送消息
                    this.sendRoomMsg(list, ['master', 'slave1'], 'group_room_out', { user_id })
                }
            }
        }
        await app.redis.hdel('user_group_room', user_id)
        return this.success()
    }

    /**
     * 发送消息
     * @param {*} list 
     * @param {*} to 
     */
    async sendRoomMsg(list, to, cmd, data) {
        const { ctx } = this
        //发送消息
        to.forEach(key => {
            const room_user = list[key] ? JSON.parse(list[key]) : null
            if (room_user) {
                ctx.send(room_user.user_id, cmd, data)
            }
        });
    }

    /**
     * 房主踢人
     */
    async gameKick() {
        const { ctx, app } = this;
        // 拿到当前用户id
        const user_id = ctx.auth.user_id
        // 验证参数
        ctx.validate({
            id: { type: 'int', required: true, min: 1 },    //被踢用户
        });
        //专业id
        const { id } = ctx.request.body;
        //所在房间
        const room_name = await app.redis.hget('user_group_room', user_id)
        if (!room_name) {
            return this.error(500, '未在房间内')
        }
        const list = await app.redis.hgetall(room_name)
        if (!list || !list['master']) {
            return this.error(500, '信息错误')
        }

        const master = JSON.parse(list['master'])
        if (master.user_id == user_id) {
            if (list['slave1']) {
                const slave = JSON.parse(list['slave1'])
                if (slave.user_id == id) {
                    const suc = await app.redis.hdel(room_name, 'slave1')
                    if (suc) {
                        this.sendRoomMsg(list, ['slave2'], 'group_room_kick', { user_id: id })
                    }
                    await app.redis.hdel('user_group_room', id)
                    return this.success()
                }
            }
            if (list['slave2']) {
                const slave = JSON.parse(list['slave2'])
                if (slave.user_id == id) {
                    const suc = await app.redis.hdel(room_name, 'slave2')
                    if (suc) {
                        this.sendRoomMsg(list, ['slave1'], 'group_room_kick', { user_id: id })
                    }
                    await app.redis.hdel('user_group_room', id)
                    return this.success()
                }
            }
        }
        this.error(500, '没有权限哦')
    }

    /**
     * 游戏邀请
     */
    async invite() {
        const { ctx, app } = this;
        const user_id = ctx.auth.user_id
        // 验证参数
        ctx.validate({
            id: { type: 'int', required: true, min: 1 },    //邀请用户id
        });
        //专业id
        const { id } = ctx.request.body;
        const ret = await app.redis.get('user_room_' + id)
        if (ret) {
            return this.error(500, '游戏进行中哦')
        }
        if (!await app.redis.exists('group_room_' + user_id)) {
            return this.error(500, '请先进入房间')
        }
        await app.redis.setex('invite_' + user_id + '_to_' + id, 60, 1)
        if (ctx.isOnline(id)) {
            ctx.send(id, 'invite_user', { user_id })
            return this.success()
        }
        this.error(500, '用户不在线哦')
    }

    /**
     * 邀请响应
     */
    async inviteDo() {
        const { ctx, app } = this;
        const user_id = ctx.auth.user_id
        // 验证参数
        ctx.validate({
            id: { type: 'int', required: true, min: 1 },    //邀请者用户id
            status: { type: 'int', required: true }
        });
        //专业id
        const { id, status } = ctx.request.body;
        const ret = await app.redis.get('invite_' + id + '_to_' + user_id)
        if (!ret) {
            return this.error(500, '邀请信息已过期')
        }
        await app.redis.del('invite_' + id + '_to_' + user_id)
        //所在房间
        const room_name = await app.redis.hget('user_group_room', id)
        if (!room_name) {
            return this.error(500, '未在房间内')
        }

        const list = await app.redis.hgetall(room_name)
        if (!list) {
            return this.error(500, '信息错误')
        }
        for (const key in list) {
            if (list.hasOwnProperty(key)) {
                const element = JSON.parse(list[key]);
                if (element.user_id == user_id) {
                    return this.error(500, '已经在房间内哦')
                }
            }
        }
        let data = {}
        if (status == 1) {//同意邀请
            let suc = false
            if (!list['slave1']) {
                suc = await app.redis.hset('group_room_' + id, 'slave1', JSON.stringify(ctx.auth))
            } else if (!list['slave2']) {
                suc = await app.redis.hset('group_room_' + id, 'slave2', JSON.stringify(ctx.auth))
            } else {
                return this.error(500, '房间满了')
            }
            if (!suc) {
                return this.error(500, '操作失败了')
            }
            await app.redis.hset('user_group_room', user_id, 'group_room_' + id)
            data.user = ctx.auth
            for (const key in list) {
                if (list.hasOwnProperty(key)) {
                    const element = JSON.parse(list[key]);
                    list[key] = element
                    ctx.send(element.user_id, 'invite_accept', data)
                }
            }
            return this.success(list)
        } else {//拒绝
            ctx.send(id, 'invite_refuse', { user_id })
        }
        return this.success()
    }

    /**
     * 游戏匹配
     */
    async gameMatch() {
        const { ctx, app } = this;
        // 拿到当前用户id
        const user = ctx.auth
        const user_id = user.user_id
        const major_id = user.major_id
        // 验证参数
        ctx.validate({
            id: { type: 'int', required: true, min: 1 },
            type: { type: 'int', required: true, values: [2, 1] },
            act: { type: 'int', required: false, default: 1 } // 1=开始匹配 0=取消匹配
        })
        //所在房间
        const room_name = await app.redis.hget('user_group_room', user_id)
        if (!room_name) {
            return this.error(500, '不在房间内')
        }
        const list = await app.redis.hgetall(room_name)
        if (!list || !list['master']) {
            return this.error(500, '信息错误')
        }
        const master = JSON.parse(list['master'])
        if (master.user_id == user_id) {
            //专业id
            const { id, type, act } = ctx.request.body;
            if (act == 1) {//开始匹配
                await app.redis.hset('group_match_list', room_name, JSON.stringify({ major_id, id, type }))
                await app.runSchedule('game_match');
            } else {//取消匹配
                await app.redis.hdel('group_match_list', room_name)
            }
            return this.success()
        }
        this.error(500, '不是房主哦')
    }

}

module.exports = GroupController;