import { NextRequest, NextResponse } from 'next/server';

const METADATA_BASE_URL = 'https://xprmint-metadata-oych.vercel.app/api/crafted/v4/metadata';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const metadataUrl = `${METADATA_BASE_URL}/${id}`;
    const response = await fetch(metadataUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Metadata API returned ${response.status}` },
        { status: response.status }
      );
    }

    const metadata = await response.json();
    return NextResponse.json(metadata, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('[API] Failed to fetch V4 metadata for', id, ':', error);
    return NextResponse.json(
      { error: 'Failed to fetch metadata' },
      { status: 500 }
    );
  }
}

