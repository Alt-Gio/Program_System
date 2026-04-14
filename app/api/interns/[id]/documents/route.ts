import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { fetchMutation } from 'convex/nextjs';
import { Id } from '@/convex/_generated/dataModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/interns/[id]/documents - Add document */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    
    if (!body.name || !body.type || !body.url) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, url' },
        { status: 400 }
      );
    }
    
    const docId = await fetchMutation(api.interns.addDocument, {
      internId: params.id as Id<'interns'>,
      name: body.name,
      type: body.type,
      url: body.url,
      uploadedBy: body.uploadedBy || undefined,
    });
    
    return NextResponse.json({ id: docId, success: true }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding document:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add document' },
      { status: 500 }
    );
  }
}

/** PATCH /api/interns/[id]/documents - Update document tags */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    
    if (!body.docId || !body.tags) {
      return NextResponse.json(
        { error: 'Missing required fields: docId, tags' },
        { status: 400 }
      );
    }
    
    await fetchMutation(api.interns.updateDocumentTags, {
      docId: body.docId as Id<'internDocuments'>,
      tags: body.tags,
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating document:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update document' },
      { status: 500 }
    );
  }
}

/** DELETE /api/interns/[id]/documents - Delete document */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get('docId');
    
    if (!docId) {
      return NextResponse.json(
        { error: 'Missing docId parameter' },
        { status: 400 }
      );
    }
    
    await fetchMutation(api.interns.deleteDocument, {
      docId: docId as Id<'internDocuments'>,
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete document' },
      { status: 500 }
    );
  }
}
