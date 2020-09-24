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
        const info = await app.model.SearchConfig.findOne({
            where: {
                index:id
            },
            attributes: ['title', 'value', 'image']
        })
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
        })
        const { id } = ctx.request.body
        const info = await app.model.SpellConfig.findOne({
            where: {
                index:id
            },
            attributes: ['title', 'value', 'image']
        })
        if (info.value) {
            info.value = JSON.parse(info.value)
        }
        return this.success(info)
    }
}

module.exports = OtherController;
