import { NextRequest, NextResponse } from 'next/server';

// 許可するIPアドレス（環境変数からも設定可能）
const ALLOWED_IPS = process.env.ALLOWED_IPS 
  ? process.env.ALLOWED_IPS.split(',').map(ip => ip.trim())
  : ['162.120.184.17', '150.249.192.229'];

// 開発環境では制限を無効化
const isDevelopment = process.env.NODE_ENV === 'development';

export function middleware(request: NextRequest) {
  // 開発環境では IP制限をスキップ
  if (isDevelopment) {
    return NextResponse.next();
  }

  // クライアントIPを取得（Cloud Runでは複数のヘッダーをチェック）
  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIp = request.headers.get('x-real-ip');
  const xClientIp = request.headers.get('x-client-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  const xOriginalForwardedFor = request.headers.get('x-original-forwarded-for');
  
  // 最初に見つかった有効なIPを使用
  let clientIp = '';
  
  if (xForwardedFor) {
    // X-Forwarded-Forヘッダーから最初のIP（実際のクライアントIP）を取得
    clientIp = xForwardedFor.split(',')[0]?.trim();
  } else if (xRealIp) {
    clientIp = xRealIp.trim();
  } else if (xClientIp) {
    clientIp = xClientIp.trim();
  } else if (cfConnectingIp) {
    clientIp = cfConnectingIp.trim();
  } else if (xOriginalForwardedFor) {
    clientIp = xOriginalForwardedFor.split(',')[0]?.trim();
  }

  // デバッグ用: すべてのヘッダーを表示
  const allHeaders: { [key: string]: string | null } = {};
  request.headers.forEach((value, key) => {
    if (key.toLowerCase().includes('ip') || key.toLowerCase().includes('forward') || key.toLowerCase().includes('client')) {
      allHeaders[key] = value;
    }
  });
  
  console.log(`All IP-related headers:`, allHeaders);
  console.log(`Parsed IP values:`, {
    'x-forwarded-for': xForwardedFor,
    'x-real-ip': xRealIp,
    'x-client-ip': xClientIp,
    'cf-connecting-ip': cfConnectingIp,
    'x-original-forwarded-for': xOriginalForwardedFor,
    'detected-client-ip': clientIp
  });
  
  console.log(`Access attempt from IP: ${clientIp}`);
  console.log(`Allowed IPs: ${JSON.stringify(ALLOWED_IPS)}`);
  console.log(`Environment ALLOWED_IPS: ${process.env.ALLOWED_IPS || 'NOT SET'}`);

  // 許可されたIPかチェック
  if (!ALLOWED_IPS.includes(clientIp)) {
    console.log(`🚫 Access denied for IP: ${clientIp}`);
    
    // アクセス拒否レスポンス
    return new NextResponse(
      JSON.stringify({
        error: 'Access Denied',
        message: 'このIPアドレスからのアクセスは許可されていません',
        ip: clientIp,
        allowedIPs: ALLOWED_IPS
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  console.log(`✅ Access granted for IP: ${clientIp}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // すべてのパスに適用（静的ファイルのみ除外）
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.ico).*)',
  ],
};