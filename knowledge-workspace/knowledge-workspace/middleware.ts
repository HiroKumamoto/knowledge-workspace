import { NextRequest, NextResponse } from 'next/server';

// 許可するIPアドレス（環境変数からも設定可能）
const ALLOWED_IPS = process.env.ALLOWED_IPS 
  ? process.env.ALLOWED_IPS.split(',').map(ip => ip.trim())
  : ['162.120.184.17'];

// 開発環境では制限を無効化
const isDevelopment = process.env.NODE_ENV === 'development';

export function middleware(request: NextRequest) {
  // 開発環境では IP制限をスキップ
  if (isDevelopment) {
    return NextResponse.next();
  }

  // クライアントIPを取得
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const clientIp = forwardedFor?.split(',')[0]?.trim() || realIp || request.ip || '';

  console.log(`Access attempt from IP: ${clientIp}`);

  // 許可されたIPかチェック
  if (!ALLOWED_IPS.includes(clientIp)) {
    console.log(`Access denied for IP: ${clientIp}`);
    
    // アクセス拒否レスポンス
    return new NextResponse(
      JSON.stringify({
        error: 'Access Denied',
        message: 'このIPアドレスからのアクセスは許可されていません',
        ip: clientIp
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  console.log(`Access granted for IP: ${clientIp}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // すべてのパスに適用（静的ファイルとAPIルートを除く）
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};