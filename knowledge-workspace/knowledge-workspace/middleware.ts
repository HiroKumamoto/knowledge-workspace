import { NextRequest, NextResponse } from 'next/server';

// 許可するIPアドレス - 直接ハードコードで確実に設定
const ALLOWED_IPS = ['162.120.184.17', '150.249.192.229', '34.143.76.2'];

// 開発環境では制限を無効化
const isDevelopment = process.env.NODE_ENV === 'development';

export function middleware(request: NextRequest) {
  // IP制限を無効化 - 全てのIPからのアクセスを許可
  return NextResponse.next();
}

export const config = {
  matcher: [
    // すべてのパスに適用（静的ファイルのみ除外）
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.ico).*)',
  ],
};