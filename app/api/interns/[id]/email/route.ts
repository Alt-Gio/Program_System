import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/interns/[id]/email - Send email to intern */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    
    if (!body.subject || !body.message) {
      return NextResponse.json(
        { error: 'Missing required fields: subject, message' },
        { status: 400 }
      );
    }
    
    // TODO: Implement email sending using your preferred service
    // Examples: SendGrid, Resend, Nodemailer, etc.
    
    // For now, just log and return success
    console.log('Email to intern:', {
      internId: params.id,
      subject: body.subject,
      message: body.message,
      type: body.type,
      senderName: body.senderName,
    });
    
    // Simulate email sending
    // await sendEmail({
    //   to: internEmail,
    //   subject: body.subject,
    //   text: body.message,
    //   from: body.senderName,
    // });
    
    return NextResponse.json({ 
      success: true,
      message: 'Email functionality not yet configured. Please set up your email service.'
    });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
