import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URLが指定されていません' },
        { status: 400 }
      );
    }

    // URLの妥当性をチェック
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      return NextResponse.json(
        { error: '無効なURLです' },
        { status: 400 }
      );
    }

    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    
    // AI解析機能を使用してURLの内容を取得
    try {
      // URLの内容を取得
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const html = await response.text();
      
      // HTMLからタイトルを抽出
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].trim() : hostname;
      
      // HTMLから本文を抽出（簡易的な実装）
      const bodyText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 3000); // 最初の3000文字まで
      
      // OpenAI APIを使用してコンテンツを要約
      if (process.env.OPENAI_API_KEY) {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: '与えられたWebページの内容を日本語で簡潔に要約してください。要約は箇条書きで、重要なポイントを3-5個程度にまとめてください。'
              },
              {
                role: 'user',
                content: `以下のWebページを要約してください：\n\nタイトル: ${pageTitle}\nURL: ${url}\n\n内容:\n${bodyText}`
              }
            ],
            max_tokens: 500,
            temperature: 0.3
          })
        });
        
        if (openaiResponse.ok) {
          const aiData = await openaiResponse.json();
          const summary = aiData.choices[0].message.content;
          
          return NextResponse.json({
            title: pageTitle,
            content: `# ${pageTitle}\n\nURL: ${url}\n\n## AI要約\n\n${summary}\n\n[元のページを開く](${url})`
          });
        }
      }
      
      // OpenAI APIが利用できない場合は基本情報のみ
      return NextResponse.json({
        title: pageTitle,
        content: `# ${pageTitle}\n\nURL: ${url}\n\n## 概要\n\n${bodyText.substring(0, 500)}...\n\n[元のページを開く](${url})`
      });
      
    } catch (fetchError) {
      console.error('コンテンツ取得エラー:', fetchError);
      
      // フェッチに失敗した場合は基本情報を返す
      // Slack URLの場合の特別な処理
      if (hostname.includes('slack.com')) {
        return NextResponse.json({
          title: `Slack - ${pathname.split('/').filter(Boolean).pop() || 'メッセージ'}`,
          content: `# Slack リンク\n\nURL: ${url}\n\n## 注意\nSlackのコンテンツはプライベートなため、直接アクセスして内容を確認してください。\n\n[Slackで開く](${url})`,
        });
      }
      
      // GitHub URLの場合
      if (hostname.includes('github.com')) {
        const parts = pathname.split('/').filter(Boolean);
        if (parts.length >= 2) {
          return NextResponse.json({
            title: `GitHub - ${parts.join('/')}`,
            content: `# GitHub リンク\n\nURL: ${url}\n\nリポジトリ: ${parts[0]}/${parts[1] || ''}\n\n[GitHubで開く](${url})`,
          });
        }
      }
      
      // その他のURLの場合は基本情報のみ
      return NextResponse.json({
        title: hostname,
        content: `# ${hostname}\n\nURL: ${url}\n\n## 内容\nこのURLの詳細な内容を取得できませんでした。直接アクセスしてください。\n\n[リンクを開く](${url})`,
      });
    }
    
  } catch (error) {
    console.error('URL解析エラー:', error);
    
    return NextResponse.json(
      { error: 'URL解析中にエラーが発生しました' },
      { status: 500 }
    );
  }
}