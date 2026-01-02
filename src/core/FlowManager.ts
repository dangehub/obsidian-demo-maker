/**
 * Demo Maker - 流程管理器
 * 负责流程文件的加载、保存和列表管理
 */

import { Plugin, TFile, TFolder } from 'obsidian';
import { FlowDefinition } from './types';

/** 流程存储目录（相对于插件目录）*/
const FLOWS_FOLDER = 'flows';

/**
 * 流程管理器
 */
export class FlowManager {
    private plugin: Plugin;
    private flowsPath: string;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
        // 流程存储在插件目录下的 flows 文件夹
        this.flowsPath = `${this.plugin.manifest.dir}/${FLOWS_FOLDER}`;
    }

    /**
     * 确保 flows 目录存在
     */
    async ensureFlowsFolder(): Promise<void> {
        const adapter = this.plugin.app.vault.adapter;
        const exists = await adapter.exists(this.flowsPath);
        if (!exists) {
            await adapter.mkdir(this.flowsPath);
        }
    }

    /**
     * 列出所有流程
     */
    async listFlows(): Promise<FlowDefinition[]> {
        await this.ensureFlowsFolder();
        const adapter = this.plugin.app.vault.adapter;

        try {
            const files = await adapter.list(this.flowsPath);
            const flows: FlowDefinition[] = [];

            for (const filePath of files.files) {
                if (filePath.endsWith('.json')) {
                    try {
                        const content = await adapter.read(filePath);
                        const flow = JSON.parse(content) as FlowDefinition;
                        flows.push(flow);
                    } catch (e) {
                        console.warn(`Demo Maker: 无法解析流程文件 ${filePath}`, e);
                    }
                }
            }

            // 按更新时间倒序排列
            flows.sort((a, b) => {
                const timeA = new Date(a.updatedAt).getTime();
                const timeB = new Date(b.updatedAt).getTime();
                return timeB - timeA;
            });

            return flows;
        } catch (e) {
            console.error('Demo Maker: 无法列出流程', e);
            return [];
        }
    }

    /**
     * 加载指定流程
     */
    async loadFlow(flowId: string): Promise<FlowDefinition | null> {
        const adapter = this.plugin.app.vault.adapter;
        const filePath = `${this.flowsPath}/${flowId}.json`;

        try {
            const exists = await adapter.exists(filePath);
            if (!exists) {
                return null;
            }

            const content = await adapter.read(filePath);
            return JSON.parse(content) as FlowDefinition;
        } catch (e) {
            console.error(`Demo Maker: 无法加载流程 ${flowId}`, e);
            return null;
        }
    }

    /**
     * 保存流程
     */
    async saveFlow(flow: FlowDefinition): Promise<boolean> {
        await this.ensureFlowsFolder();
        const adapter = this.plugin.app.vault.adapter;
        const filePath = `${this.flowsPath}/${flow.id}.json`;

        try {
            // 更新时间戳
            flow.updatedAt = new Date().toISOString();

            const content = JSON.stringify(flow, null, 2);
            await adapter.write(filePath, content);
            return true;
        } catch (e) {
            console.error(`Demo Maker: 无法保存流程 ${flow.id}`, e);
            return false;
        }
    }

    /**
     * 删除流程
     */
    async deleteFlow(flowId: string): Promise<boolean> {
        const adapter = this.plugin.app.vault.adapter;
        const filePath = `${this.flowsPath}/${flowId}.json`;

        try {
            const exists = await adapter.exists(filePath);
            if (!exists) {
                return false;
            }

            await adapter.remove(filePath);
            return true;
        } catch (e) {
            console.error(`Demo Maker: 无法删除流程 ${flowId}`, e);
            return false;
        }
    }

    /**
     * 生成唯一 ID
     */
    generateId(prefix: string = 'flow'): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 6);
        return `${prefix}-${timestamp}-${random}`;
    }

    /**
     * 创建新流程
     */
    createNewFlow(name: string, description?: string): FlowDefinition {
        const now = new Date().toISOString();
        return {
            id: this.generateId('flow'),
            name,
            description,
            version: '1.0',
            createdAt: now,
            updatedAt: now,
            steps: [],
        };
    }
}
