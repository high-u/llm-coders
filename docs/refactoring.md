# リファクタリング計画書

## 概要

本アプリケーションを docs/rules.md で定められたアーキテクチャ原則に従ってリファクタリングする。
CLIアプリケーションとして、LLMとの対話・コーディング機能を提供する。

## 現在の構造と問題点

### 現在の構造

```plain
src/
├── components/           # UI コンポーネント（React）
├── externals/llm.ts     # LLM API 呼び出し
├── usecases/chat.ts     # チャット機能（グローバル状態管理）
└── main.tsx             # エントリーポイント + UI ロジック
```

### 主要な問題点

1. **層の責任分離違反**: ChatService で会話履歴管理（ドメインロジック）と外部API呼び出し（副作用）が混在
2. **グローバル状態の使用**: conversationHistory のグローバル変数は設計思想に反する
3. **設定管理の曖昧さ**: config からの設定読み取りが main.tsx で行われている
4. **UI層とビジネスロジックの混在**: main.tsx でUI表示とビジネスロジックが混在

## 目標アーキテクチャ

### 新しい構造

下記は役割や責任の分離を元に想定した構成。フォルダ名やファイル名は、実際の内容に合わせて命名する。

```plain
src/
├── interfaces/cli/           # CLI インターフェース層
│   ├── components/           # React コンポーネント
│   │   ├── NormalInput.tsx
│   │   └── SelectItem.tsx
│   └── index.ts             # エントリーポイント
├── usecases/                 # ビジネスロジック層
│   ├── core/                # アプリ固有ドメインロジック（純粋関数）
│   │   ├── messageFormat.ts  # メッセージフォーマット処理
│   │   ├── agentConfig.ts   # エージェント設定変換
│   │   └── historyUtils.ts  # 履歴操作ユーティリティ
│   └── chat/                # チャット機能
│       ├── dependencies.ts   # 依存関係定義
│       └── chatUseCases.ts  # チャット機能実装
└── externals/               # 外部アクセス層
    ├── llm/                 # LLM API
    │   ├── functions/       # 純粋関数
    │   │   ├── parseStream.ts
    │   │   └── formatRequest.ts
    │   └── index.ts
    ├── configuration/       # 設定ファイル読み込み
    │   ├── functions/       # 純粋関数
    │   │   ├── parseConfig.ts
    │   │   └── validateConfig.ts
    │   └── index.ts
    └── conversationHistory/ # 会話履歴リポジトリ
        ├── functions/       # 純粋関数
        │   ├── addMessage.ts
        │   ├── clearHistory.ts
        │   └── filterByAgent.ts
        └── index.ts         # メモリ永続化実装
```

## 状態管理設計

### 状態の分類と管理方針

#### 1. データ（永続化対象）→ externals層

- **会話履歴**: conversationHistory リポジトリで管理
- **エージェント設定**: configuration external で設定ファイルから読み込み
- 特徴: 複数usecasesから利用、永続化の可能性

#### 2. UI状態 → interfaces層（React useState）

- **処理中フラグ**: isProcessing
- **エージェント選択**: selectedAgent  
- **入力中テキスト**: input
- 特徴: 一時的、UI表示のみに関連

#### 3. ビジネスロジック状態 → usecases層

- **チャット処理フロー**: 一時的な処理状態
- **バリデーション結果**: 入力検証結果
- 特徴: 処理の流れ管理、純粋関数の組み合わせ

### 状態管理ライブラリの検討結果

**Zustand**: ❌ 不採用

- 理由: Node.js環境でReact状態管理ライブラリは過剰
- UI状態は最小限でReact標準のuseStateで十分

**データリポジトリパターン**: ✅ 採用

- 会話履歴を「データ」として捉え、external層で管理
- UI状態とデータを完全分離

### イベント処理設計

#### 3層イベントチェーンパターン

各層がイベントを受け取り、加工してから次の層にイベントを発火する設計：

```plain
externals (OpenAI API) でイベント発火
  ↓
usecases でリッスン・加工してイベント発火  
  ↓
interfaces (CLI) でリッスン・UI反映
```

#### 具体的な実装例

```typescript
// externals/llm/ - 生のストリーミングデータ
onStreamChunk({ type: 'raw_chunk', data: rawData });

// usecases/chat/ - ビジネスロジック適用
onChatEvent({ 
  type: 'message_chunk', 
  message: processedMessage, 
  agent: currentAgent 
});

// interfaces/cli/ - UI反映
onUIUpdate({ 
  type: 'display_update', 
  displayData: uiFormattedData 
});
```

#### 現在の問題

```typescript
// ❌ usecasesからUIを直接操作
await ChatService.chat(/* UIコールバック */);
```

#### 改善アプローチ

```typescript
// ✅ 3層イベントチェーンによる責任分離
// externals → usecases → interfaces の順でイベント伝播
```

## 移行計画

### Phase 1: 基本構造の整備

**目標**: 層の分離とディレクトリ構成の整備

1. ディレクトリ構造の作成
   - `src/interfaces/cli/` の作成
   - `src/usecases/chat/` の作成  
   - `src/usecases/core/` の作成
   - `src/externals/conversationHistory/` の作成
   - `src/externals/configuration/` の作成

2. ファイル移動
   - `main.tsx` → `interfaces/cli/index.ts`
   - `components/` → `interfaces/cli/components/`
   - `usecases/chat.ts` → `usecases/chat/chatUseCases.ts`

3. 動作確認
   - 既存機能が正常に動作することを確認

### Phase 2: 会話履歴リポジトリの分離

**目標**: データと状態の分離

1. conversationHistory リポジトリの実装

   ```typescript
   // externals/conversationHistory/index.ts
   export const createConversationHistoryRepository = () => ({
     add: (message: ChatMessage) => void,
     clear: () => void,
     getHistory: () => ChatMessage[],
     filterByAgent: (agentId: string) => ChatMessage[]
   });
   ```

2. usecases層の修正
   - グローバル状態を削除
   - リポジトリを依存関係として注入

3. 動作確認
   - 会話履歴の管理が正常に動作することを確認

### Phase 3: 純粋関数の抽出

**目標**: ドメインロジックの純粋関数化

1. core層の実装
   - メッセージフォーマット処理
   - エージェント設定変換処理
   - 履歴操作ユーティリティ

2. externals層のfunctions実装
   - ストリーミング解析処理
   - API リクエスト形成処理

3. テストの追加
   - 純粋関数のユニットテスト作成

### Phase 4: 依存関係の整理

**目標**: Factory Function パターンの適用

1. 依存関係定義ファイルの作成

   ```typescript
   // usecases/chat/dependencies.ts
   export type ChatDependencies = {
     llmExternal: LLMExternal;
     conversationHistoryRepository: ConversationHistoryRepository;
     configExternal: ConfigExternal;
   };
   ```

2. Factory Function の実装

   ```typescript
   export const createChatUseCases = (deps: ChatDependencies) => ({
     sendMessage: async (message: string) => { /* */ },
     clearHistory: () => { /* */ },
     switchAgent: (agent: Agent) => { /* */ }
   });
   ```

3. interfaces層の修正
   - Factory Function を使用してusecasesを初期化

### Phase 5: 設定管理の整理

**目標**: 機能ごとの設定分散管理

1. 設定ファイル読み込みをexternal層に移動

   ```typescript
   // externals/configuration/index.ts
   export const createConfigurationExternal = () => ({
     getAgentConfig: () => readConfigFile('./agents.json'),
     getChatConfig: () => readConfigFile('./chat.json')
   });
   
   // usecases/chat/chatUseCases.ts
   export const createChatUseCases = (deps: { configExternal: ConfigExternal }) => {
     const config = deps.configExternal.getChatConfig();
     // ...
   };
   ```

2. 共通インフラ設定の分離
   - ファイルシステム操作は全てexternal層で実装

## リスク管理

### 技術的リスク

1. **UI応答性**: React状態とusecases層の状態同期
   - 対策: イベント駆動アーキテクチャの導入
2. **ストリーミングの継続性**: 現在のリアルタイム更新を維持
   - 対策: コールバック機構の段階的移行
3. **設定の互換性**: 既存のconfig構造との互換性
   - 対策: 段階的移行と下位互換性の保持

### 運用リスク

1. **機能退行**: 既存機能の動作不良
   - 対策: 各Phase後の動作確認徹底
2. **開発効率低下**: 過度なアーキテクチャ変更
   - 対策: 最小限の変更で最大効果を狙う段階的アプローチ

## 完了条件

### 機能要件

- [ ] 既存のチャット機能が正常に動作する
- [ ] エージェント切替機能が正常に動作する
- [ ] ストリーミング表示が正常に動作する
- [ ] 会話履歴の管理が正常に動作する

### 非機能要件

- [ ] docs/rules.md の5つの必須ルールに準拠
- [ ] 各層の責任分離が明確になっている
- [ ] 依存関係が一方向になっている
- [ ] 純粋関数とFactory Functionパターンが適用されている
- [ ] テストコードが追加されている

### 品質要件

- [ ] TypeScript の型安全性が保たれている
- [ ] ESLint/Prettier によるコード品質が保たれている
- [ ] 各機能が独立してテスト可能になっている

## 参考資料

- [docs/rules.md](./rules.md) - アーキテクチャ原則
- [現在のソースコード](../src/) - リファクタリング対象
