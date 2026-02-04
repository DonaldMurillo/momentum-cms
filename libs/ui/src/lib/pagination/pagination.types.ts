export type PaginationItem = number | 'ellipsis';

/**
 * Generate pagination items with ellipsis for large page counts.
 */
export function generatePaginationItems(
	currentPage: number,
	totalPages: number,
	siblingCount = 1,
): PaginationItem[] {
	// For small page counts, just return all pages
	const totalPageNumbers = siblingCount * 2 + 5; // siblings + first + last + current + 2 ellipsis positions
	if (totalPages <= totalPageNumbers) {
		return Array.from({ length: totalPages }, (_, i) => i + 1);
	}

	const items: PaginationItem[] = [];

	// Always show first page
	items.push(1);

	// Calculate range around current page
	const leftSibling = Math.max(2, currentPage - siblingCount);
	const rightSibling = Math.min(totalPages - 1, currentPage + siblingCount);

	// Add left ellipsis if needed (when there's a gap between 1 and leftSibling)
	const showLeftEllipsis = leftSibling > 2;
	if (showLeftEllipsis) {
		items.push('ellipsis');
	}

	// Add pages around current
	for (let page = leftSibling; page <= rightSibling; page++) {
		if (page !== 1 && page !== totalPages) {
			items.push(page);
		}
	}

	// Add right ellipsis if needed (when there's a gap between rightSibling and last page)
	const showRightEllipsis = rightSibling < totalPages - 1;
	if (showRightEllipsis) {
		items.push('ellipsis');
	}

	// Always show last page
	items.push(totalPages);

	return items;
}
