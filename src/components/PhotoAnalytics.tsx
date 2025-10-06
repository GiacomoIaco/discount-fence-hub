import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Star, Heart, Flag as FlagIcon, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { showError } from '../lib/toast';

interface PhotoAnalyticsProps {
  onBack: () => void;
  userRole?: 'sales' | 'operations' | 'sales-manager' | 'admin';
}

interface UploaderStats {
  user_id: string;
  uploader_name: string;
  photos_published: number;
  total_likes: number;
  total_favorites: number;
  total_client_selections: number;
  avg_quality_score: number;
  avg_confidence_score: number;
  first_published_at: string;
  last_published_at: string;
}

type TimeFrame = '7days' | '30days' | '90days' | 'all';

const PhotoAnalytics = ({ onBack }: PhotoAnalyticsProps) => {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('30days');
  const [uploaderStats, setUploaderStats] = useState<UploaderStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [timeFrame]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Calculate date filter based on timeframe
      let dateFilter = '';
      const now = new Date();

      switch (timeFrame) {
        case '7days':
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = sevenDaysAgo.toISOString();
          break;
        case '30days':
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateFilter = thirtyDaysAgo.toISOString();
          break;
        case '90days':
          const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          dateFilter = ninetyDaysAgo.toISOString();
          break;
        case 'all':
          dateFilter = '';
          break;
      }

      // Fetch uploader stats with time filter
      let query = supabase
        .from('photos')
        .select('uploaded_by, uploader_name, status, likes, is_favorite, quality_score, confidence_score, uploaded_at, client_selections');

      if (dateFilter) {
        query = query.gte('uploaded_at', dateFilter);
      }

      const { data: photos, error } = await query;

      if (error) throw error;

      // Process data to calculate stats per uploader
      const statsMap = new Map<string, UploaderStats>();

      photos?.forEach(photo => {
        const key = photo.uploaded_by || 'unknown';
        const existing = statsMap.get(key) || {
          user_id: photo.uploaded_by || 'unknown',
          uploader_name: photo.uploader_name || 'Unknown',
          photos_published: 0,
          total_likes: 0,
          total_favorites: 0,
          total_client_selections: 0,
          avg_quality_score: 0,
          avg_confidence_score: 0,
          first_published_at: photo.uploaded_at,
          last_published_at: photo.uploaded_at,
        };

        if (photo.status === 'published') {
          existing.photos_published += 1;
          existing.total_likes += photo.likes || 0;
          if (photo.is_favorite) existing.total_favorites += 1;

          // Count client selections
          if (photo.client_selections && Array.isArray(photo.client_selections)) {
            existing.total_client_selections += photo.client_selections.length;
          }

          // Update date range
          if (photo.uploaded_at < existing.first_published_at) {
            existing.first_published_at = photo.uploaded_at;
          }
          if (photo.uploaded_at > existing.last_published_at) {
            existing.last_published_at = photo.uploaded_at;
          }
        }

        statsMap.set(key, existing);
      });

      // Convert to array and sort by photos published
      const statsArray = Array.from(statsMap.values())
        .filter(s => s.photos_published > 0)
        .sort((a, b) => b.photos_published - a.photos_published);

      setUploaderStats(statsArray);
    } catch (error) {
      console.error('Error loading analytics:', error);
      showError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Uploader', 'Photos Published', 'Total Likes', 'Total Favorites', 'Client Selections'];
    const rows = uploaderStats.map(stat => [
      stat.uploader_name,
      stat.photos_published,
      stat.total_likes,
      stat.total_favorites,
      stat.total_client_selections,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `photo-analytics-${timeFrame}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPhotos = uploaderStats.reduce((sum, s) => sum + s.photos_published, 0);
  const totalLikes = uploaderStats.reduce((sum, s) => sum + s.total_likes, 0);
  const totalFavorites = uploaderStats.reduce((sum, s) => sum + s.total_favorites, 0);
  const totalSelections = uploaderStats.reduce((sum, s) => sum + s.total_client_selections, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold">Photo Analytics</h1>
                <p className="text-sm text-gray-500">Performance metrics by uploader</p>
              </div>
            </div>

            <button
              onClick={exportToCSV}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Time Frame Selector */}
        <div className="flex space-x-2 mb-6">
          {(['7days', '30days', '90days', 'all'] as TimeFrame[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                timeFrame === tf
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tf === '7days' && 'Last 7 Days'}
              {tf === '30days' && 'Last 30 Days'}
              {tf === '90days' && 'Last 90 Days'}
              {tf === 'all' && 'All Time'}
            </button>
          ))}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ImageIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Published</p>
                <p className="text-2xl font-bold">{totalPhotos}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Heart className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Likes</p>
                <p className="text-2xl font-bold">{totalLikes}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Favorites</p>
                <p className="text-2xl font-bold">{totalFavorites}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FlagIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Client Selections</p>
                <p className="text-2xl font-bold">{totalSelections}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Uploader Rankings */}
        <div className="bg-white rounded-lg border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-bold">Uploader Rankings</h2>
            <p className="text-sm text-gray-500">Sorted by photos published</p>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading analytics...</div>
          ) : uploaderStats.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No data available for this time period</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploader</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Published</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Likes</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Favorites</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Client Selections</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {uploaderStats.map((stat, index) => (
                    <tr key={stat.user_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {index < 3 ? (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                              index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'
                            }`}>
                              {index + 1}
                            </div>
                          ) : (
                            <span className="text-gray-500 font-medium">{index + 1}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{stat.uploader_name}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <ImageIcon className="w-4 h-4 text-gray-400" />
                          <span className="font-semibold">{stat.photos_published}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Heart className="w-4 h-4 text-red-400" />
                          <span className="font-semibold">{stat.total_likes}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Star className="w-4 h-4 text-yellow-400" />
                          <span className="font-semibold">{stat.total_favorites}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <FlagIcon className="w-4 h-4 text-green-400" />
                          <span className="font-semibold">{stat.total_client_selections}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoAnalytics;
