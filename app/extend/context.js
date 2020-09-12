
module.exports = {

    /**
     * 发送消息
     * @param {*} to_id 
     * @param {*} cmd 
     * @param {*} data 
     */
    async send(to_id, cmd, data) {
        const { app, service } = this;
        let pid = await service.cache.get("online_" + to_id);

        if (pid) {
            app.messenger.sendTo(pid, "send", { to_id, cmd, data });
        }
    },

    genId(length) {
        return Number(
            Math.random().toString.substr(3, length) + Date.now()
        ).toString(36);
    },

    /**
     * 上线
     * @param {*} user_id 
     */
    async online(user_id) {
        const { service, app } = this;
        let pid = process.pid;
        let opid = await service.cache.get("online_" + user_id);
        if (opid) {
            app.messenger.sendTo(opid, "offline", user_id);
        }
        service.cache.set("online_" + user_id, pid);
    },

    /**
     * 是否在线
     * @param {*} user_id 
     */
    async isOnline(user_id) {
        const {service, app} = this;
        return await service.cache.exist('online_' +user_id)
    }
};
