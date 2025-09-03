export async function analyzeUrl(url: string): Promise<{
  title: string;
  content: string;
  error?: string;
}> {
  try {
    // URLの妥当性をチェック
    new URL(url);
    
    // フロントエンドからAPIルートを呼び出す
    const response = await fetch('/api/analyze-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'URL解析に失敗しました');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('URL解析エラー:', error);
    return {
      title: '',
      content: '',
      error: error instanceof Error ? error.message : 'URL解析に失敗しました',
    };
  }
}

// URLかどうかを判定する関数
export function isValidUrl(text: string): boolean {
  try {
    const url = new URL(text.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Slack URLかどうかを判定する関数
export function isSlackUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('slack.com');
  } catch {
    return false;
  }
}