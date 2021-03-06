'use strict';

const Controller = require('./base');

/**
 * 找一找 拼拼乐
 */
class OtherController extends Controller {

    /**
     * 找一找 - 总关数
     */
    async searchCount() {
        const { app, ctx } = this
        // 验证参数
        ctx.validate({
            id: { type: 'int', required: true, min: 1 } //选择专业id
        });
        //专业id
        const { id } = ctx.request.body;
        const count = await app.model.SearchConfig.count({
            where: { major_id: id }
        })
        return this.success({ count })
    }

    /**
     * 找一找 - 关详情
     */
    async searchInfo() {
        const { app, ctx } = this
        ctx.validate({
            id: { type: 'int', required: true, min: 1 },
        })
        const { id } = ctx.request.body
        const info = await app.model.SearchConfig.findAll({
            where: {
                index:id
            },
            attributes: ['title', 'value', 'image','major_id']
        })
        if (!info) {
            return this.error(500, '不存在哦')
        }
        if (info.value) {
            info.value = JSON.parse(info.value)
        }
        return this.success(info)
    }

    /**
     * 拼拼乐 - 总关数
     */
    async spellCount() {
        const { app, ctx } = this
        // 验证参数
        ctx.validate({
            id: { type: 'int', required: true, min: 1 } //选择专业id
        });
        //专业id
        const { id } = ctx.request.body;
        const count = await app.model.SpellConfig.count({
            where: { major_id: id }
        })
        return this.success({ count })
    }

    /**
     * 拼拼乐 - 关详情
     */
    async spellInfo() {
        const { app, ctx } = this
        ctx.validate({
            id: { type: 'int', required: true, min: 1 },
            major_id: { type: 'int', required: true, min: 1 },
        })
        const { id,major_id } = ctx.request.body
        const info = await app.model.SpellConfig.findAll({
            where: {
                index:id,
            },
            attributes: ['title', 'value', 'image','major_id']
        })
        if (!info) {
            return this.error(500, '不存在哦')
        }
        if (info.value) {
            info.value = JSON.parse(info.value)
        }
        return this.success(info)
    }
}

module.exports = OtherController;
