"use strict";

const Service = require("egg").Service;

class CacheService extends Service {

    /**
     * 后去列表
     * @param {string} key 键
     * @param {boolean} isChildObject 元素是否为对象
     * @return {array} 返回数组
     */
    async getList(key, isChildObject = false) {
        const { redis } = this.app;
        let data = await redis.lrange(key, 0, -1);
        if (isChildObject) {
            data = data.map((item) => {
                return JSON.parse(item);
            });
        }
        return data;
    }

    /**
     * 设置列表
     * @param {string} key 键
     * @param {object|string} value 值
     * @param {string} type 类型 push和unshift
     * @param {Number} expir 过期时间 单位秒
     * @return {Number} 返回索引
     */
    async setList(key, value, type = "push", expir = 0) {
        const { redis } = this.app;
        if (expir > 0) {
            await redis.expire(key, expir);
        }
        if (typeof value === "object") {
            value = JSON.stringify(value);
        }
        if (type === "push") {
            return await redis.rpush(key, value);
        }
        return await redis.lpush(key, value);
    }

    /**
     * 设置redis缓存
     * @param {string} key 键
     * @param {string | object | array} value 值
     * @param {Number} expir 过期时间
     * @return {String} 返回成功字符串OK
     */
    async set(key, value, expir = 0) {
        const { redis } = this.app;
        if (expir === 0) {
            return await redis.set(key, JSON.stringify(value));
        } else {
            return await redis.set(key, JSON.stringify(value), "EX", expir);
        }
    }

    async get(key) {
        const { redis } = this.app;
        const result = await redis.get(key);
        return JSON.parse(result);
    }

    async exist(key){
        const { redis } = this.app;
        return await redis.exists(key);
    }

    async incr(key, number = 1) {
        const { redis } = this.app;
        if (number === 1) {
            return await redis.incr(key);
        } else {
            return await redis.incrby(key, number);
        }
    }

    async strlen(key) {
        const { redis } = this.app;
        return await redis.strlen(key);
    }

    async remove(key) {
        const { redis } = this.app;
        return await redis.del(key);
    }

    async clear() {
        return await this.app.redis.flushall();
    }

    async inGame(user_id, major_id){
        const {redis} = this.app;
        return await redis.sadd('game_major_'+major_id, user_id);
    }

}

module.exports = CacheService;
