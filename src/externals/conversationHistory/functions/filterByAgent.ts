import { ChatMessage } from '../../../usecases/core/messageFormat';

export const filterByAgent = (history: ChatMessage[], agentName: string): ChatMessage[] => {
	// 現在の実装では特定のエージェント情報がメッセージに含まれていないため、
	// 全履歴を返す（将来的にエージェント情報をメッセージに含める場合の拡張ポイント）
	return [...history];
};