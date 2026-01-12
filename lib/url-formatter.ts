/**
 * Utility functions for formatting URLs for display
 */

/**
 * Formats a URL for display by:
 * 1. Stripping https://, http://, and www.
 * 2. Displaying domain first, followed by path
 * 3. Truncating if too long
 * 
 * @param url - The URL to format
 * @param maxLength - Maximum length before truncation (default: 50)
 * @returns Formatted URL string or null if URL is invalid
 */
export function formatUrlForDisplay(url: string | null | undefined, maxLength: number = 50): string | null {
  if (!url) return null;

  try {
    // Parse the URL to handle it properly
    const urlObj = new URL(url);
    
    // Get domain (hostname without www.)
    let domain = urlObj.hostname.replace(/^www\./i, '');
    
    // Get path (including query and hash if present)
    const path = urlObj.pathname + urlObj.search + urlObj.hash;
    
    // Combine domain and path
    let formatted = domain + path;
    
    // Truncate if too long
    if (formatted.length > maxLength) {
      formatted = formatted.substring(0, maxLength - 3) + '...';
    }
    
    return formatted;
  } catch {
    // If URL parsing fails, try simple string manipulation
    let cleaned = url
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '');
    
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength - 3) + '...';
    }
    
    return cleaned;
  }
}

/**
 * Gets a display title for an item, falling back to formatted URL if title is missing
 * 
 * @param title - The item title
 * @param sourceUrl - The source URL to use as fallback
 * @param maxLength - Maximum length for the formatted URL (default: 50)
 * @returns Display title or formatted URL
 */
export function getItemDisplayTitle(
  title: string | null | undefined,
  sourceUrl: string | null | undefined,
  maxLength: number = 50
): string {
  if (title) return title;
  
  const formattedUrl = formatUrlForDisplay(sourceUrl, maxLength);
  return formattedUrl || 'Untitled Item';
}
