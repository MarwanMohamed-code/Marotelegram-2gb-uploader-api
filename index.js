// =======================================================
// 1. TELEGRAM CONFIGURATION
// =======================================================
const BOTTOKEN = Deno.env.get("BOTTOKEN") || "BOTTOKEN_REQUIRED";
const CHATID = Deno.env.get("CHATID") || "CHATID_REQUIRED";
const TELEGRAMUPLOADURL = `https://api.telegram.org/bot${BOTTOKEN}/sendDocument`;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// =======================================================
// 2. FILE UPLOAD HANDLER (POST /upload_file)
// =======================================================
async function handleUpload(req) {
    if (BOTTOKEN === "BOTTOKEN_REQUIRED") {
        return new Response(
            JSON.stringify({ success: false, message: "Server Error: BOTTOKEN is not configured." }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file');

        if (!file || typeof file === 'string') {
            return new Response(
                JSON.stringify({ success: false, message: "No file part in the request (Field name must be 'file')." }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const telegramFormData = new FormData();
        telegramFormData.append('chat_id', CHATID);
        telegramFormData.append('caption', `Uploaded via Web App: ${file.name}`);
        telegramFormData.append('document', file, file.name); 

        // 1. إرسال الملف إلى Telegram (يدعم حتى 2GB)
        const telegramResponse = await fetch(TELEGRAMUPLOADURL, {
            method: 'POST',
            body: telegramFormData,
        });

        if (!telegramResponse.ok) {
            const errorText = await telegramResponse.text();
            throw new Error(`Telegram API Upload Failed: ${telegramResponse.status} - ${errorText}`);
        }

        const data = await telegramResponse.json();

        if (data.ok) {
            const documentInfo = data.result.document;
            const fileId = documentInfo.file_id;
            const fileName = file.name;
            
            // ✅ الحل لـ 2GB: فقط نُرجع file_id.
            return new Response(
                JSON.stringify({
                    success: true,
                    file_id: fileId,
                    filename: fileName,
                    message: "File uploaded successfully, ready for client streaming."
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        } else {
            throw new Error(`Telegram API Error: ${data.description || 'Unknown error'}`);
        }

    } catch (e) {
        console.error(e);
        return new Response(
            JSON.stringify({ success: false, message: e.message || "An unexpected server error occurred." }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}

// =======================================================
// 3. MAIN ROUTER
// =======================================================
Deno.serve(async (req) => {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (pathname.startsWith('/upload_file') && req.method === 'POST') {
        return handleUpload(req);
    }
    
    return new Response(
        JSON.stringify({ success: false, message: 'Invalid route. Use POST /upload_file to upload files.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
});
