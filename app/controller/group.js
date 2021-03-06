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
        const {
            ctx,
            app
        } = this;
        // 拿到当前用户id
        const user_id = ctx.auth.user_id
        // 验证参数
        ctx.validate({
            id: {
                type: 'int',
                required: true,
                min: 1
            },
            type: {
                type: 'int',
                required: true,
                values: [2, 1]
            }
        })
        const {
            id,
            type
        } = ctx.request.body
        await app.redis.hmset('user_group_' + user_id, {
            master: JSON.stringify(ctx.auth),
            id,
            type
        })
        await app.redis.setex('user_group_room_' + user_id, 1800, 'user_group_' + user_id)
        await app.redis.expire('user_group_' + user_id, 1800)
        return this.success()
    }

    /**
     * 再来一局
     */
    async nextGame() {
        const {
            ctx,
            app
        } = this;
        // 拿到当前用户id
        const user_id = ctx.auth.user_id
        if (await app.redis.exists('user_group_room_' + user_id)) {
            return this.error(500, '已经在房间内')
        }
        const room_name = await app.redis.get('old_user_group_room_' + user_id)
        if (!room_name) {
            return this.error(500, '已过期了哦')
        }
        const old_room_info = await app.redis.hgetall('old_' + room_name)
        if (Object.keys(old_room_info).length == 0) {
            return this.error(500, '房间已解散哦')
        }
        //房间内人状态房主/房客
        let room_type = ''
        let user_info = {}
        for (const key in old_room_info) {
            if (old_room_info.hasOwnProperty(key)) {
                if (key == 'master' || key == 'slave1' || key == 'slave2') {
                    const element = JSON.parse(old_room_info[key])
                    if (element.user_id == user_id) {
                        room_type = key
                        user_info = element
                    }
                }
            }
        }
        const master_user = JSON.parse(old_room_info['master'])
        if (room_type == '') {
            return this.error(500, '信息错误')
        }
        //给其他发送再来一局消息
        this.sendRoomMsg(old_room_info, ['slave2', 'slave1', 'master'], 'group_next_show', {
            user_id,
            master: master_user.user_id
        })

        await app.redis.del('old_user_group_room_' + user_id)
        if (await app.redis.exists(room_name)) { //有人已经在房间内
            let users = await app.redis.hgetall(room_name)
            if (users[room_type]) {
                return this.error(500, '房间位置已被占用')
            }
            await app.redis.hset(room_name, room_type, JSON.stringify(user_info))
            await app.redis.setex('user_group_room_' + user_id, 1800, room_name)
            //发送消息
            for (const key in users) {
                if (users.hasOwnProperty(key)) {
                    if (key == 'master' || key == 'slave1' || key == 'slave2') {
                        const element = JSON.parse(users[key]);
                        users[key] = element
                        ctx.send(element.user_id, 'invite_accept', {
                            user: user_info,
                            room_type
                        })
                    }
                }
            }
            users.room_type = room_type
            return this.success(users)
        } else {
            let room = {}
            room[room_type] = JSON.stringify(user_info)
            room.id = old_room_info.id
            room.type = old_room_info.type
            await app.redis.hmset(room_name, room)
            await app.redis.setex('user_group_room_' + user_id, 1800, room_name)
            await app.redis.expire(room_name, 1800)
            return this.success({
                id: room.id,
                type: room.type,
                room_type
            })
        }
    }

    /**
     * 修改房间信息
     */
    async edit() {
        const {
            ctx,
            app
        } = this;
        // 拿到当前用户id
        const user_id = ctx.auth.user_id
        // 验证参数
        ctx.validate({
            id: {
                type: 'int',
                required: true,
                min: 1
            },
            type: {
                type: 'int',
                required: true,
                values: [2, 1]
            }
        })
        const {
            id,
            type
        } = ctx.request.body
        //所在房间
        const room_name = await app.redis.get('user_group_room_' + user_id)
        if (!room_name) {
            return this.error(500, '不在房间内')
        }
        const list = await app.redis.hgetall(room_name)
        if (!list || !list['master']) {
            return this.error(500, '信息错误')
        }
        const master = JSON.parse(list['master'])
        if (master.user_id != user_id) {
            return this.error(500, '没有权限哦')
        }
        if (list.id == id && list.type == type) {
            return this.success()
        }
        await app.redis.hmset('user_group_' + user_id, {
            id,
            type
        })
        //发送消息
        this.sendRoomMsg(list, ['slave1', 'slave2'], 'group_room_edit', {
            id,
            type
        })
        return this.success()
    }

    /**
     * 游戏结束清除数据
     */
    async endGame() {
        const {
            ctx,
            app
        } = this;
        // 拿到当前用户id
        const user_id = ctx.auth.user_id
        const room_name = await app.redis.get('old_user_group_room_' + user_id)
        if (!room_name) {
            return this.success()
        }
        const old_room_info = await app.redis.hgetall('old_' + room_name)
        //房间内人状态房主/房客
        for (const key in old_room_info) {
            if (old_room_info.hasOwnProperty(key)) {
                if (key == 'master') {
                    const element = JSON.parse(old_room_info[key])
                    if (element.user_id == user_id) { //房主退出，解散房间
                        await app.redis.del('old_' + room_name)
                        //发送消息  
                        if (old_room_info['slave1']) {
                            const slave = JSON.parse(old_room_info['slave1']);
                            ctx.send(slave.user_id, 'group_room_cancel', {
                                user_id: slave.user_id
                            })
                        }
                        if (old_room_info['slave2']) {
                            const slave = JSON.parse(old_room_info['slave2']);
                            ctx.send(slave.user_id, 'group_room_cancel', {
                                user_id: slave.user_id
                            })
                        }
                        //如果房客再来一局已经进入房间，解散该房间
                        if (await app.redis.exists(room_name)) { //有人已经在房间内
                            await app.redis.del(room_name)
                        }
                    }
                }
            }
        }
        await app.redis.del('old_user_group_room_' + user_id)
        return this.success()
    }

    /**
     * 房主取消邀请
     */
    async cancelInvite() {
        const {
            ctx,
            app
        } = this;
        const user_id = ctx.auth.user_id
        // 验证参数
        ctx.validate({
            id: {
                type: 'int',
                required: true,
                min: 1
            }, //邀请者用户id
        });
        //专业id
        const {
            id
        } = ctx.request.body;
        await app.redis.del('invite_' + user_id + '_to_' + id)
        return this.success()
    }

    /**
     * 被邀请人退出房间
     */
    async outGame() {
        const {
            ctx,
            app
        } = this;
        // 拿到当前用户id
        const user_id = ctx.auth.user_id
        //所在房间
        const room_name = await app.redis.get('user_group_room_' + user_id)
        if (!room_name) {
            return this.error(500, '未在房间内')
        }
        const list = await app.redis.hgetall(room_name)
        if (!list) {
            return this.error(500, '信息错误')
        }
        for (const key in list) {
            if (list == 'id' || list == 'type') continue
            if (list.hasOwnProperty(key)) {
                const element = JSON.parse(list[key]);
                if (key == 'master' && element.user_id == user_id) { //房主退出，直接解散房间
                    await app.redis.del(room_name)
                    await app.redis.del('user_group_room_' + user_id)
                    if (list['slave1']) {
                        const room_user = JSON.parse(list['slave1'])
                        await app.redis.del('user_group_room_' + room_user.user_id)
                        this.sendRoomMsg(list, ['slave1'], 'group_room_cancel', {
                            user_id: room_user.user_id
                        })
                    }
                    if (list['slave2']) {
                        const room_user = JSON.parse(list['slave2'])
                        await app.redis.del('user_group_room_' + room_user.user_id)
                        this.sendRoomMsg(list, ['slave2'], 'group_room_cancel', {
                            user_id: room_user.user_id
                        })
                    }
                    return this.success()
                } else if (key == 'slave1' && element.user_id == user_id) {
                    const suc = await app.redis.hdel(room_name, 'slave1')
                    if (!suc) {
                        return this.error(500, '无需退出')
                    }
                    //发送消息
                    this.sendRoomMsg(list, ['master', 'slave2'], 'group_room_out', {
                        user_id
                    })
                } else if (key == 'slave2' && element.user_id == user_id) {
                    const suc = await app.redis.hdel(room_name, 'slave2')
                    if (!suc) {
                        return this.error(500, '无需退出')
                    }
                    //发送消息
                    this.sendRoomMsg(list, ['master', 'slave1'], 'group_room_out', {
                        user_id
                    })
                }
            }
        }
        await app.redis.del('user_group_room_' + user_id)
        return this.success()
    }

    /**
     * 发送消息
     * @param {*} list 
     * @param {*} to 
     */
    async sendRoomMsg(list, to, cmd, data) {
        const {
            ctx
        } = this
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
        const {
            ctx,
            app
        } = this;
        // 拿到当前用户id
        const user_id = ctx.auth.user_id
        // 验证参数
        ctx.validate({
            id: {
                type: 'int',
                required: true,
                min: 1
            }, //被踢用户
        });
        const {
            id
        } = ctx.request.body;
        //所在房间
        const room_name = await app.redis.get('user_group_room_' + user_id)
        if (!room_name) {
            return this.error(500, '未在房间内')
        }
        const list = await app.redis.hgetall(room_name)
        if (!list || !list['master']) {
            return this.error(500, '信息错误')
        }

        const master = JSON.parse(list['master'])
        if (master.user_id == user_id) {
            //发送给被踢人
            ctx.send(id, 'group_room_kick', {
                user_id: id
            })
            await app.redis.del('user_group_room_' + id)
            //发送给房间内的其他人
            if (list['slave1']) {
                const slave = JSON.parse(list['slave1'])
                if (slave.user_id == id) {
                    const suc = await app.redis.hdel(room_name, 'slave1')
                    if (suc) {
                        this.sendRoomMsg(list, ['slave2'], 'group_room_kick', {
                            user_id: id
                        })
                    }
                    return this.success()
                }
            }
            if (list['slave2']) {
                const slave = JSON.parse(list['slave2'])
                if (slave.user_id == id) {
                    const suc = await app.redis.hdel(room_name, 'slave2')
                    if (suc) {
                        this.sendRoomMsg(list, ['slave1'], 'group_room_kick', {
                            user_id: id
                        })
                    }
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
        const {
            ctx,
            app
        } = this;
        const user_id = ctx.auth.user_id
        // 验证参数
        ctx.validate({
            id: {
                type: 'int',
                required: true,
                min: 1
            }, //邀请用户id
        });
        //专业id
        const {
            id
        } = ctx.request.body;
        if (await app.redis.get('user_room_' + id)) {
            return this.error(500, '游戏进行中哦')
        }
        if (await app.redis.get('user_group_room_' + id)) {
            return this.error(500, '组队中');
        }
        if (await app.redis.exists('user_one_room_' + id)) {
            return this.error(500, '组队中')
        }
        if (await app.redis.exists('invite_' + user_id + '_to_' + id)) {
            return this.error(500, '已邀请，请等待对方响应')
        }
        const room_name = await app.redis.get('user_group_room_' + user_id)
        if (!room_name) {
            return this.error(500, '请先进入房间')
        }

        const room_info = await app.redis.hgetall(room_name)
        if (ctx.isOnline(id)) {
            await app.redis.setex('invite_' + user_id + '_to_' + id, 65, 1)
            ctx.send(id, 'invite_user', {
                user_id,
                id: parseInt(room_info.id),
                type: parseInt(room_info.type)
            })
            app.queue_invite.push({
                user_id,
                id
            }, function (err) {
                err && console.log(err)
            });
            return this.success()
        }
        this.error(500, '用户不在线哦')
    }

    /**
     * 邀请响应
     */
    async inviteDo() {
        const {
            ctx,
            app
        } = this;
        const user_id = ctx.auth.user_id
        // 验证参数
        ctx.validate({
            id: {
                type: 'int',
                required: true,
                min: 1
            }, //邀请者用户id
            status: {
                type: 'int',
                required: true
            }
        });
        //专业id
        const {
            id,
            status
        } = ctx.request.body;
        const ret = await app.redis.get('invite_' + id + '_to_' + user_id)
        if (!ret) {
            return this.error(500, '邀请信息已过期')
        }
        await app.redis.del('invite_' + id + '_to_' + user_id)
        //所在房间
        const room_name = await app.redis.get('user_group_room_' + id)
        if (!room_name) {
            return this.error(500, '未在房间内')
        }

        const list = await app.redis.hgetall(room_name)
        if (!list) {
            return this.error(500, '信息错误')
        }
        for (const key in list) {
            if (list.hasOwnProperty(key)) {
                if (key == 'master' || key == 'slave1' || key == 'slave2') {
                    const element = JSON.parse(list[key]);
                    if (element.user_id == user_id) {
                        return this.error(500, '已经在房间内哦')
                    }
                }
            }
        }
        let data = {}
        if (status == 1) { //同意邀请
            let suc = false
            if (!list['slave1']) {
                suc = await app.redis.hset('user_group_' + id, 'slave1', JSON.stringify(ctx.auth))
            } else if (!list['slave2']) {
                suc = await app.redis.hset('user_group_' + id, 'slave2', JSON.stringify(ctx.auth))
            } else {
                return this.error(500, '房间满了')
            }
            if (!suc) {
                return this.error(500, '操作失败了')
            }
            await app.redis.setex('user_group_room_' + user_id, 1800, 'user_group_' + id)
            data.user = ctx.auth
            for (const key in list) {
                if (list.hasOwnProperty(key)) {
                    const element = JSON.parse(list[key]);
                    if (typeof Object) {
                        list[key] = element
                        ctx.send(element.user_id, 'invite_accept', data)
                    }
                }
            }
            return this.success(list)
        } else { //拒绝
            ctx.send(id, 'invite_refuse', {
                user_id
            })
        }
        return this.success()
    }

    /**
     * 游戏匹配
     */
    async gameMatch() {
        const {
            ctx,
            app
        } = this;
        // 拿到当前用户id
        const user = ctx.auth
        const user_id = user.user_id
        const major_id = user.major_id
        // 验证参数
        ctx.validate({
            id: {
                type: 'int',
                required: true,
                min: 1
            },
            type: {
                type: 'int',
                required: true,
                values: [2, 1]
            },
            act: {
                type: 'int',
                required: false,
                default: 1
            } // 1=开始匹配 0=取消匹配
        })
        //所在房间
        const room_name = await app.redis.get('user_group_room_' + user_id)
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
            const {
                id,
                type,
                act
            } = ctx.request.body;
            if (act == 1) { //开始匹配
                await app.redis.hset('group_match_list', room_name, JSON.stringify({
                    major_id,
                    id,
                    type
                }))
                await app.runSchedule('game_match');
            } else { //取消匹配
                await app.redis.hdel('group_match_list', room_name)
            }
            return this.success()
        }
        this.error(500, '不是房主哦')
    }

}

module.exports = GroupController;