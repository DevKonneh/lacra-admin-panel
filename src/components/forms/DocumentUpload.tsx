import React, { useRef, useState, useCallback } from 'react';
import { UploadCloud, FileText, CheckCircle2, XCircle, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import type { UploadedFile } from '../../pages/apply/types';
import { uploadApplicationDocument } from '../../api/applications';

interface DocumentUploadProps {
    label: string;
    required?: boolean;
    accept: string;
    acceptDisplay: string;
    maxSizeMb: number;
    helpText?: string;
    value: UploadedFile | null;
    onChange: (file: UploadedFile | null) => void;
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Professional document-upload card: shows required/optional badge, accepted
// formats, max size, a real upload progress bar (tracked via axios's
// onUploadProgress against POST /api/applications/upload), success/failure
// state, and replace/delete controls with an image or filename preview.
// On success, the returned Cloudinary URL is stored in UploadedFile.url
// (persistent, survives page reloads) - previewUrl remains a local,
// ephemeral object URL used only for instant client-side preview.
const DocumentUpload: React.FC<DocumentUploadProps> = ({
    label, required, accept, acceptDisplay, maxSizeMb, helpText, value, onChange,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);
    const [localError, setLocalError] = useState('');

    const acceptedExtensions = accept.split(',').map((e) => e.trim().toLowerCase());

    const validateAndUpload = useCallback((file: File) => {
        setLocalError('');
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!acceptedExtensions.includes(ext)) {
            setLocalError(`Unsupported file type. Accepted: ${acceptDisplay}`);
            return;
        }
        if (file.size > maxSizeMb * 1024 * 1024) {
            setLocalError(`File is too large. Maximum size is ${maxSizeMb} MB.`);
            return;
        }

        const id = `${Date.now()}-${file.name}`;
        const isImage = file.type.startsWith('image/');
        const previewUrl = isImage ? URL.createObjectURL(file) : undefined;

        const uploaded: UploadedFile = {
            id, name: file.name, size: file.size, type: file.type,
            previewUrl, status: 'uploading', progress: 0,
        };
        onChange(uploaded);

        uploadApplicationDocument(file, (percent) => {
            onChange({ ...uploaded, status: 'uploading', progress: percent });
        })
            .then((res) => {
                const url = res.data?.data?.url;
                onChange({ ...uploaded, status: 'done', progress: 100, url });
            })
            .catch((err) => {
                const message =
                    err?.response?.data?.message || 'Upload failed. Please check your connection and try again.';
                onChange({ ...uploaded, status: 'error', progress: 0, errorMessage: message });
            });
    }, [acceptedExtensions, acceptDisplay, maxSizeMb, onChange]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) validateAndUpload(file);
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) validateAndUpload(file);
    };

    const handleRemove = () => {
        if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
        onChange(null);
        setLocalError('');
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">{label}</p>
                        <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                required ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                            }`}
                        >
                            {required ? 'Required' : 'Optional'}
                        </span>
                    </div>
                    {helpText && <p className="text-xs text-slate-500 mt-0.5">{helpText}</p>}
                    <p className="text-xs text-slate-400 mt-0.5">
                        Accepted: {acceptDisplay} &middot; Max {maxSizeMb} MB
                    </p>
                </div>
            </div>

            {!value && (
                <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-6 px-4 text-center cursor-pointer transition-colors ${
                        dragOver ? 'border-brand-green bg-brand-green/5' : 'border-slate-300 hover:border-brand-green/60 hover:bg-slate-50'
                    }`}
                >
                    <UploadCloud size={22} className="text-slate-400" />
                    <p className="text-sm text-slate-600">
                        <span className="text-brand-green font-medium">Click to upload</span> or drag and drop
                    </p>
                </div>
            )}

            <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFileSelect} />

            {localError && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle size={13} /> {localError}
                </p>
            )}

            {value && (
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    {value.previewUrl || value.url ? (
                        <img src={value.previewUrl || value.url} alt="" className="h-12 w-12 rounded-md object-cover flex-shrink-0 border border-slate-200" />
                    ) : (
                        <div className="h-12 w-12 rounded-md bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                            <FileText size={20} className="text-slate-400" />
                        </div>
                    )}

                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{value.name}</p>
                        <p className="text-xs text-slate-500">{formatBytes(value.size)}</p>

                        {value.status === 'uploading' && (
                            <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                                <div
                                    className="h-full bg-brand-green transition-all duration-200"
                                    style={{ width: `${value.progress}%` }}
                                />
                            </div>
                        )}
                        {value.status === 'done' && (
                            <p className="mt-1 text-xs text-green-700 flex items-center gap-1">
                                <CheckCircle2 size={13} /> Upload complete
                            </p>
                        )}
                        {value.status === 'error' && (
                            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                <XCircle size={13} /> {value.errorMessage || 'Upload failed'} - click the retry icon to try again.
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            type="button"
                            title="Replace document"
                            onClick={() => inputRef.current?.click()}
                            className="p-2 rounded-lg text-slate-500 hover:bg-white hover:text-brand-green transition-colors"
                        >
                            <RefreshCw size={16} />
                        </button>
                        <button
                            type="button"
                            title="Delete document"
                            onClick={handleRemove}
                            className="p-2 rounded-lg text-slate-500 hover:bg-white hover:text-red-600 transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentUpload;
