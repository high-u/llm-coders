import { LLMService, StreamEvent } from '../externals/llm';

interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

// グローバル変数で会話履歴を保持
let conversationHistory: ChatMessage[] = [];

export class ChatService {
	// 会話処理のメイン関数
	static async chat(
		endpoint: string,
		model: string,
		userPrompt: string,
		onEvent: (event: StreamEvent) => void
	): Promise<void> {
		// 1. ユーザーメッセージを履歴に追加
		conversationHistory.push({ role: 'user', content: userPrompt });
		
		// 2. LLMServiceを履歴付きで呼び出し
		let assistantResponse = '';
		
		await LLMService.streamChat(
			endpoint,
			model,
			conversationHistory, // グローバル履歴を渡す
			(event) => {
				if (event.type === 'chunk') {
					assistantResponse += event.data || '';
				} else if (event.type === 'complete') {
					// 3. アシスタント応答を履歴に追加
					conversationHistory.push({ role: 'assistant', content: assistantResponse });
				}
				
				// 4. 元のイベントハンドラーに転送
				onEvent(event);
			}
		);
	}
	
	// 履歴をクリア
	static clearHistory(): void {
		conversationHistory = [];
	}
	
	// 履歴を取得（デバッグ用）
	static getHistory(): ChatMessage[] {
		return [...conversationHistory];
	}
}