import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, 
  Image as ImageIcon, 
  Mic, 
  Clock, 
  Check, 
  Play, 
  Pause, 
  X,
  Tag,
  ExternalLink
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { getWhatsappSubmissions } from '../../services/supabase/whatsapp';
import type { WhatsappSubmission } from '../../services/supabase/whatsapp';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { formatCurrency, formatMiles } from '../../utils/formatting';

type FilterType = 'all' | 'text' | 'image' | 'voice' | 'flagged';

function WhatsAppIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.709 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function formatParsedValue(key: string, value: any): string {
  if (value === undefined || value === null) return '';
  
  if (typeof value === 'number') {
    if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('rate')) {
      return formatCurrency(value);
    }
    if (key.toLowerCase().includes('miles')) {
      return formatMiles(value);
    }
    return value.toString();
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  return value.toString();
}

function formatSubmissionDate(dateStr: string) {
  try {
    const date = parseISO(dateStr);
    const relative = formatDistanceToNow(date, { addSuffix: true });
    const absolute = format(date, 'MMM d, h:mm a');
    return { relative, absolute };
  } catch (error) {
    return { relative: 'recently', absolute: dateStr };
  }
}

function VoicePlayer({ transcript }: { transcript: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 2;
        });
      }, 100);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const barHeights = [12, 24, 16, 8, 20, 28, 14, 18, 22, 10, 16, 26, 12, 18, 24, 10];

  return (
    <div className="flex flex-col gap-2 mt-2">
      <div className="flex items-center gap-3 bg-navy-900/60 rounded-xl p-3 border border-white/5">
        <button
          onClick={() => {
            setIsPlaying(!isPlaying);
            if (!isPlaying && progress === 0) {
              setProgress(0);
            }
          }}
          className="w-8 h-8 rounded-full bg-brand-green/20 text-brand-green flex items-center justify-center hover:bg-brand-green/30 active:scale-95 transition-all shrink-0"
          aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-brand-green text-brand-green" />
          ) : (
            <Play className="w-4 h-4 fill-brand-green text-brand-green ml-0.5" />
          )}
        </button>
        
        <div className="flex items-end gap-0.5 flex-1 h-8 px-1">
          {barHeights.map((height, i) => {
            const barProgress = (i / barHeights.length) * 100;
            const isActive = progress > barProgress;
            return (
              <div
                key={i}
                className="w-1 rounded-full transition-all duration-300"
                style={{
                  height: `${height}px`,
                  backgroundColor: isActive 
                    ? '#22c55e' 
                    : 'rgba(255, 255, 255, 0.15)',
                }}
              />
            );
          })}
        </div>

        <span className="text-xs text-gray-400 font-mono select-none shrink-0">
          {isPlaying ? `0:${Math.floor(progress / 10).toString().padStart(2, '0')}` : '0:12'}
        </span>
      </div>
      
      <div className="text-xs text-gray-300 bg-navy-900/30 p-2.5 rounded-lg border border-white/5 italic">
        <span className="text-gray-500 not-italic font-medium mr-1.5 font-sans">Transcript:</span>
        "{transcript.replace(/^\[Voice Note:\s*"/i, '').replace(/"\]$/i, '')}"
      </div>
    </div>
  );
}

export default function WhatsAppLogPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [submissions, setSubmissions] = useState<WhatsappSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const PAGE_LIMIT = 10;

  const fetchSubmissions = async (isLoadMore = false) => {
    if (!user?.id) return;
    
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const currentOffset = isLoadMore ? offset : 0;
      const newItems = await getWhatsappSubmissions(user.id, PAGE_LIMIT, currentOffset);
      
      setSubmissions((prev) => {
        if (isLoadMore) {
          const existingIds = new Set(prev.map(item => item.id));
          const filteredNewItems = newItems.filter(item => !existingIds.has(item.id));
          
          if (filteredNewItems.length === 0 || newItems.length < PAGE_LIMIT) {
            setHasMore(false);
          }
          return [...prev, ...filteredNewItems];
        } else {
          if (newItems.length < PAGE_LIMIT) {
            setHasMore(false);
          } else {
            setHasMore(true);
          }
          return newItems;
        }
      });

      if (newItems.length > 0) {
        setOffset(isLoadMore ? (prev) => prev + PAGE_LIMIT : PAGE_LIMIT);
      }
    } catch (err) {
      console.error('Error loading WhatsApp submissions:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchSubmissions(false);
  }, [user?.id]);

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
  };

  const getFilteredSubmissions = () => {
    return submissions.filter((sub) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'text') return sub.input_method === 'text';
      if (activeFilter === 'image') return sub.input_method === 'image';
      if (activeFilter === 'voice') return sub.input_method === 'voice';
      if (activeFilter === 'flagged') return sub.status === 'failed';
      return true;
    });
  };

  const filteredSubmissions = getFilteredSubmissions();

  const getMethodIcon = (method: 'text' | 'image' | 'voice') => {
    switch (method) {
      case 'text':
        return <MessageSquare className="w-4 h-4 text-brand-green" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-blue-400" />;
      case 'voice':
        return <Mic className="w-4 h-4 text-purple-400" />;
    }
  };

  const formatIntentName = (intent: string) => {
    if (!intent) return 'Unknown Intent';
    return intent
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const openMilesBot = () => {
    window.open('https://wa.me/12815550001', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col min-h-screen bg-navy-900 text-white pb-12">
      <PageHeader 
        title="WhatsApp Submission Log" 
        showBack={true} 
        onBack={() => navigate('/driver/home')} 
      />

      <div className="px-4 py-4 max-w-lg mx-auto w-full flex-1 flex flex-col">
        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 select-none shrink-0">
          {(['all', 'text', 'image', 'voice', 'flagged'] as FilterType[]).map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => handleFilterChange(filter)}
                className={`px-4 py-2 text-xs font-semibold rounded-full capitalize transition-all duration-200 shrink-0 border border-white/5 active:scale-95 ${
                  isActive
                    ? 'bg-brand-green text-navy-900 border-brand-green shadow-md shadow-brand-green/20'
                    : 'bg-navy-800 text-gray-400 hover:text-white hover:border-white/10'
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        {loading ? (
          <div className="flex-1 flex flex-col gap-4 py-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-navy-800 border border-white/5 rounded-2xl p-4 animate-pulse space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-navy-700" />
                    <div className="space-y-2">
                      <div className="h-4 w-28 bg-navy-700 rounded" />
                      <div className="h-3 w-20 bg-navy-700 rounded" />
                    </div>
                  </div>
                  <div className="h-6 w-16 bg-navy-700 rounded-full" />
                </div>
                <div className="h-16 bg-navy-700/50 rounded-xl" />
                <div className="flex gap-2">
                  <div className="h-6 w-20 bg-navy-700 rounded-lg" />
                  <div className="h-6 w-24 bg-navy-700 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-10">
            <EmptyState
              icon={WhatsAppIcon}
              title="No submissions found"
              message={
                activeFilter === 'all' 
                  ? 'Send logs, fuel receipts, or miles updates directly to MilesBot on WhatsApp to get started.'
                  : `No WhatsApp submissions match the filter "${activeFilter}".`
              }
              ctaLabel="Open MilesBot"
              onCta={openMilesBot}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            {filteredSubmissions.map((sub) => {
              const { relative, absolute } = formatSubmissionDate(sub.created_at);
              const isVerified = !!(sub.linked_expense_id || sub.linked_load_id);

              return (
                <div 
                  key={sub.id} 
                  className="bg-navy-800 border border-white/5 rounded-2xl p-4 hover:border-white/10 hover:shadow-lg transition-all duration-300 flex flex-col gap-3.5 relative overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-navy-900 border border-white/5">
                        {getMethodIcon(sub.input_method)}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white font-sans leading-tight">
                          {formatIntentName(sub.intent)}
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-0.5 font-mono">
                          {sub.sender_number}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {isVerified && (
                        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                      
                      {sub.linked_expense_id && (
                        <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                          Expense Linked
                        </span>
                      )}
                      
                      {sub.linked_load_id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/driver/loads/${sub.linked_load_id}`);
                          }}
                          className="bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border border-indigo-500/30 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors"
                        >
                          Load Linked
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      )}
                      
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
                        sub.status === 'processed'
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : sub.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-brand-red/10 text-brand-red border-brand-red/20'
                      }`}>
                        {sub.status}
                      </span>
                    </div>
                  </div>

                  {/* Raw Content Area */}
                  {sub.input_method === 'text' && (
                    <div className="bg-navy-900/50 rounded-xl p-3 border border-white/5">
                      <p className="text-sm text-gray-200 leading-relaxed italic">
                        "{sub.content}"
                      </p>
                    </div>
                  )}

                  {sub.input_method === 'image' && (
                    <div className="bg-navy-900/50 rounded-xl p-3 border border-white/5 flex flex-col gap-2">
                      {sub.content.startsWith('http') ? (
                        <div className="relative group w-32 h-32 rounded-lg overflow-hidden border border-white/10 hover:border-white/20 transition-colors">
                          <img 
                            src={sub.content} 
                            alt="Receipt thumbnail" 
                            className="w-full h-full object-cover cursor-zoom-in group-hover:scale-105 transition-transform duration-300"
                            onClick={() => setPreviewImage(sub.content)}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <ExternalLink className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-200 leading-relaxed italic">
                          "{sub.content}"
                        </p>
                      )}
                    </div>
                  )}

                  {sub.input_method === 'voice' && (
                    <VoicePlayer transcript={sub.content} />
                  )}

                  {/* Extracted Data Chips */}
                  {sub.parsed_data && Object.keys(sub.parsed_data).length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1 text-[11px] text-gray-500 font-semibold uppercase tracking-wider">
                        <Tag className="w-3 h-3 text-brand-green" />
                        <span>Extracted Data</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(sub.parsed_data).map(([key, val]) => (
                          <span 
                            key={key} 
                            className="bg-navy-900/40 text-gray-300 text-xs px-2.5 py-1 rounded-lg border border-white/5 flex items-center gap-1.5 font-sans"
                          >
                            <span className="text-gray-500 font-medium capitalize">
                              {key.replace('_', ' ')}:
                            </span>
                            <span className="text-white font-semibold">
                              {formatParsedValue(key, val)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timestamp Footer */}
                  <div className="flex items-center gap-1 text-[11px] text-gray-500 border-t border-white/5 pt-2.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-sans font-medium">{relative}</span>
                    <span className="text-gray-700">•</span>
                    <span className="font-sans font-medium">{absolute}</span>
                  </div>
                </div>
              );
            })}

            {/* Pagination Load More Button */}
            {hasMore && (
              <button
                onClick={() => fetchSubmissions(true)}
                disabled={loadingMore}
                className="w-full py-3 bg-navy-800 hover:bg-navy-750 text-brand-green border border-brand-green/20 hover:border-brand-green/40 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 mt-4 active:scale-98 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loadingMore ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <span>Load More Logs</span>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lightbox Receipt Image Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button 
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 bg-navy-800/80 border border-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
            aria-label="Close preview"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={previewImage} 
            alt="Receipt Full Preview" 
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
