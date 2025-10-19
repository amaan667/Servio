# Any Types Analysis Report

Generated: 2025-10-19T15:53:37.851Z

## Summary
- **Total any types:** 326
- **Files affected:** 126

## By Category

### unknown (288)
- `/Users/amaan/Downloads/servio-mvp-cleaned/app/admin/migrate-ai/page.tsx:108` - {migrationStatus.migrationStatus?.map((status: any, index: number) => (
- `/Users/amaan/Downloads/servio-mvp-cleaned/app/api/ai/messages/route.ts:256` - } catch (aiError: any) {
- `/Users/amaan/Downloads/servio-mvp-cleaned/app/api/ai-assistant/conversations/route.ts:117` - const transformedConversations = (conversations || []).map((conv: any) => ({
- `/Users/amaan/Downloads/servio-mvp-cleaned/app/api/ai-assistant/undo/route.ts:170` - async function undoMenuTranslation(venueId: string, undoData: any, supabase: any) {
- `/Users/amaan/Downloads/servio-mvp-cleaned/app/api/ai-assistant/undo/route.ts:312` - const itemsToTranslate = batch.map((item: any) => ({
... and 283 more

### route-params (12)
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/ai/assistant-llm.ts:449` - params: any,
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/ai/tool-executors.ts:453` - params: any,
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/ai/tool-executors.ts:1030` - params: any,
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/ai/tool-executors.ts:1084` - params: any,
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/ai/tool-executors.ts:1141` - params: any,
... and 7 more

### record-type (10)
- `/Users/amaan/Downloads/servio-mvp-cleaned/app/api/dashboard/orders/[id]/route.ts:25` - const update: Record<string, any> = {};
- `/Users/amaan/Downloads/servio-mvp-cleaned/app/order-summary/[orderId]/page.tsx:145` - const [feedbackResponses, setFeedbackResponses] = useState<Record<string, any>>({});
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/cache.ts:133` - async mset(keyValues: Record<string, any>, ttl = 3600): Promise<void> {
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/csv.ts:8` - export interface CsvColumn<T extends Record<string, any>> {
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/csv.ts:35` - export function toCSV<T extends Record<string, any>>(
... and 5 more

### error-handling (8)
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/auth/utils.ts:38` - export function handleAuthError(error: any): { message: string; code: string } {
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/monitoring.ts:37` - captureException(error: Error, context?: Record<string, any>) {
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/pdfImporter/mainImporter.ts:333` - result.validation.errors.forEach((error: any) => lines.push(`  • ${error}`));
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/retry.ts:11` - retryCondition?: (error: any) => boolean;
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/retry.ts:19` - retryCondition: (error: any) => {
... and 3 more

### response-param (3)
- `/Users/amaan/Downloads/servio-mvp-cleaned/app/order-summary/[orderId]/page.tsx:315` - const handleFeedbackResponse = (questionId: string, response: any) => {
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/ai/context-builders.ts:536` - export async function getAllSummaries(venueId: string, features: any) {
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/cache/index.ts:14` - private memoryCache: Map<string, { value: any; expires: number }> = new Map();


### data-type (3)
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/pdfImporter/mainImporter.ts:307` - export function generateImportReport(result: any): string {
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/pdfImporter/mainImporter.ts:359` - export function validateImportResult(result: any): {
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/pdfImporter/mainImporter.ts:404` - export function exportImportResult(result: any): string {


### request-param (1)
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/auth/supabase-callback.ts:9` - export async function handleGoogleCallback(req: any, res: any) {


### request-body (1)
- `/Users/amaan/Downloads/servio-mvp-cleaned/lib/pdfImporter/schemaValidator.ts:255` - payload: any,



## By File

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/ai/tool-executors.ts (17)
- Line 453: params: any,
- Line 760: after: translatedArray.map((i: any) => ({
- Line 892: const validItems = translatedArray.filter((item: any) =>
- Line 961: const updateData: any = {
- Line 1030: params: any,
- Line 1084: params: any,
- Line 1141: params: any,
- Line 1209: const orderCount = new Set(orderItems?.map((item: any) => item.orders.id)).size;
- Line 1256: params: any,
- Line 1286: params: any,
- Line 1339: params: any,
- Line 1374: params: any,
- Line 1573: params: any,
- Line 1634: const orderCount = new Set(orderItems?.map((item: any) => item.orders.id)).size;
- Line 1688: topItems?.forEach((item: any) => {
- Line 1730: params: any,
- Line 1793: params: any,

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/table-sessions/actions/route.ts (13)
- Line 93: async function handleStartPreparing(supabase: any, table_id: string, order_id: string) {
- Line 126: async function handleMarkReady(supabase: any, table_id: string, order_id: string) {
- Line 159: async function handleMarkServed(supabase: any, table_id: string, order_id: string) {
- Line 192: async function handleMarkAwaitingBill(supabase: any, table_id: string) {
- Line 211: async function handleCloseTable(supabase: any, table_id: string) {
- Line 274: async function handleReserveTable(supabase: any, table_id: string, customer_name: string, reservatio
- Line 477: async function handleOccupyTable(supabase: any, table_id: string) {
- Line 570: async function handleMoveTable(supabase: any, table_id: string, destination_table_id: string) {
- Line 628: async function handleMergeTable(supabase: any, venue_id: string, table_id: string, destination_table
- Line 654: async function handleUnmergeTable(supabase: any, table_id: string) {
- Line 742: const firstTable = allTables?.find((t: any) => t.label.includes(firstTableNum) && t.id !== table_id)
- Line 743: const secondTable = allTables?.find((t: any) => t.label.includes(secondTableNum) && t.id !== table_i
- Line 796: async function handleCancelReservation(supabase: any, table_id: string, reservation_id: string) {

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/ai/context-builders.ts (12)
- Line 127: orderItems?.forEach((oi: any) => {
- Line 156: items.forEach((item: any) => {
- Line 182: const allItems = items.map((item: any) => ({
- Line 318: ?.filter((ticket: any) => {
- Line 324: .map((ticket: any) => {
- Line 332: items: ticket.items.map((i: any) => i.name),
- Line 356: completedTickets?.forEach((ticket: any) => {
- Line 447: recentItems?.forEach((item: any) => {
- Line 460: recentItems?.forEach((item: any) => {
- Line 512: contextData: any
- Line 536: export async function getAllSummaries(venueId: string, features: any) {
- Line 537: const summaries: any = {

### /Users/amaan/Downloads/servio-mvp-cleaned/components/demo-analytics.tsx (11)
- Line 16: let ChartContainer: any = null;
- Line 17: let ResponsiveContainer: any = null;
- Line 18: let LineChart: any = null;
- Line 19: let BarChart: any = null;
- Line 20: let Bar: any = null;
- Line 21: let Line: any = null;
- Line 22: let XAxis: any = null;
- Line 23: let YAxis: any = null;
- Line 24: let CartesianGrid: any = null;
- Line 25: let Tooltip: any = null;
- Line 146: const StatCard = ({ title, value, icon: Icon, subtitle, trend }: any) => (

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/ai-assistant/undo/route.ts (10)
- Line 170: async function undoMenuTranslation(venueId: string, undoData: any, supabase: any) {
- Line 312: const itemsToTranslate = batch.map((item: any) => ({
- Line 368: const validItems = translatedArray.filter((item: any) =>
- Line 415: const missingItems = items.filter((item: any) => !translatedIds.has(item.id));
- Line 417: logger.warn(`[AI UNDO] ${missingItems.length} items were not translated:`, missingItems.map((item: a
- Line 431: async function undoMenuPriceUpdate(venueId: string, undoData: any, supabase: any) {
- Line 465: async function undoMenuAvailabilityToggle(venueId: string, undoData: any, supabase: any) {
- Line 495: async function undoMenuItemCreation(venueId: string, undoData: any, supabase: any) {
- Line 521: async function undoMenuItemDeletion(venueId: string, undoData: any, supabase: any) {
- Line 556: async function undoInventoryAdjustment(venueId: string, undoData: any, supabase: any) {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/dashboard/[venueId]/analytics/AnalyticsClient.tsx (10)
- Line 133: const validOrders = (orders || []).filter((order: any) =>
- Line 141: const totalRevenue = validOrders.reduce((sum: number, order: any) => sum + (order.total_amount || 0)
- Line 194: periodOrdersList = validOrders.filter((order: any) => {
- Line 203: periodOrdersList = validOrders.filter((order: any) => {
- Line 212: periodOrdersList = validOrders.filter((order: any) => {
- Line 218: periodRevenue = periodOrdersList.reduce((sum: number, order: any) => sum + (order.total_amount || 0)
- Line 236: validOrders.forEach((order: any) => {
- Line 238: order.items.forEach((item: any) => {
- Line 348: filteredOrders.forEach((order: any) => {
- Line 350: order.items.forEach((item: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/parseMenuFC.ts (10)
- Line 48: function reassignCategory(it: any) {
- Line 130: const tooLong = raw.items.filter((i: any) => (i.name||'').length > 80);
- Line 132: const noPrice = raw.items.filter((i: any) => typeof i.price !== 'number' || isNaN(i.price) || i.pric
- Line 134: const afterBasic = raw.items.filter((i: any) => (i.name||'').length && typeof i.price === 'number' &
- Line 139: const normalizedKept = kept.map((item: any) => ({
- Line 144: })).filter((item: any) => !isNaN(item.price));
- Line 146: const reassigned = moved.map((m: any) => {
- Line 149: }).filter((m: any) => m && !isNaN(m.price));
- Line 164: const validatedItems = finalItems.map((item: any, index: number) => ({
- Line 171: })).filter((item: any) => !isNaN(item.price) && item.price > 0 && item.name.length > 0);

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/pdfImporter/mainImporter.ts (10)
- Line 29: supabaseClient: any,
- Line 109: } catch (layoutError: any) {
- Line 128: items: gptResult.items.map((item: any) => ({
- Line 278: function applyPostProcessing(catalog: ParsedCatalog, options: any): ParsedCatalog {
- Line 307: export function generateImportReport(result: any): string {
- Line 333: result.validation.errors.forEach((error: any) => lines.push(`  • ${error}`));
- Line 337: result.validation.warnings.forEach((warning: any) => lines.push(`  • ${warning}`));
- Line 344: result.warnings.forEach((warning: any) => lines.push(`  • ${warning}`));
- Line 359: export function validateImportResult(result: any): {
- Line 404: export function exportImportResult(result: any): string {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/table-sessions/enhanced-merge/route.ts (7)
- Line 141: async function mergeFreeTables(supabase: any, sourceTable: any, targetTable: any) {
- Line 204: async function expandOccupiedTable(supabase: any, sourceTable: any, targetTable: any, sourceIsFree: 
- Line 268: async function expandReservedTable(supabase: any, sourceTable: any, targetTable: any, sourceIsFree: 
- Line 319: async function mergeOccupiedTables(supabase: any, sourceTable: any, targetTable: any) {
- Line 333: const sourceSession = sessions.find((s: any) => s.table_id === sourceTable.id);
- Line 334: const targetSession = sessions.find((s: any) => s.table_id === targetTable.id);
- Line 420: async function mergeReservedTables(supabase: any, sourceTable: any, targetTable: any) {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/dashboard/[venueId]/live-orders/LiveOrdersClient.tsx (7)
- Line 366: const liveOrderIds = new Set((liveData || []).map((order: any) => order.id));
- Line 369: const allTodayFiltered = allData.filter((order: any) => {
- Line 377: }).map((order: any) => {
- Line 669: filteredActiveOrders = (activeOrders || []).filter((o: any) => o.table_id === orderData.table_id);
- Line 671: filteredActiveOrders = (activeOrders || []).filter((o: any) => o.table_number === orderData.table_nu
- Line 773: filteredActiveOrders = (activeOrders || []).filter((o: any) => o.table_id === orderData.table_id);
- Line 775: filteredActiveOrders = (activeOrders || []).filter((o: any) => o.table_number === orderData.table_nu

### /Users/amaan/Downloads/servio-mvp-cleaned/components/ai/chat-interface.tsx (7)
- Line 44: toolParams?: any;
- Line 45: executionResult?: any;
- Line 49: undoData?: any;
- Line 174: const transformedMessages = (data.messages || []).map((msg: any) => ({
- Line 326: const sendMessageToConversation = async (userMessage: string, conversation: any) => {
- Line 434: const previewPromises = planData.plan.tools.map(async (tool: any) => {
- Line 630: const handleUndo = async (messageId: string, undoData: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/dashboard/[venueId]/page.client.tsx (6)
- Line 54: venue?: any;
- Line 414: const updateRevenueIncrementally = (newOrder: any) => {
- Line 421: amount = newOrder.items.reduce((s: number, it: any) => {
- Line 440: const loadStats = useCallback(async (vId: string, window: any) => {
- Line 485: const todayRevenue = ordersArray.reduce((sum: number, order: any) => {
- Line 489: amount = order.items.reduce((s: number, it: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/menu/process/route.ts (5)
- Line 153: const itemsWithPage = items.map((item: any) => ({
- Line 213: const itemsToInsert = allMenuItems.map((item: any) => ({
- Line 230: .map((item: any, index: number) => {
- Line 231: const menuItem = insertedItems.find((mi: any) => mi.name === item.name);
- Line 247: .filter((h: any) => h !== null);

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/pdfImporter/googleVisionOCR.ts (5)
- Line 15: let client: any, storage: any;
- Line 108: parsed.responses.forEach((page: any, pageIndex: number) => {
- Line 135: function extractBlocksFromPage(pageAnnotation: any, pageIndex: number): TextBlock[] {
- Line 151: const text = line.words.map((w: any) => w.text).join(' ');
- Line 270: const text = words.map((w: any) => w.text).join(' ');

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/pdfImporter/jsonRepair.ts (5)
- Line 125: let currentItem: any = {};
- Line 230: function isValidItem(item: any): boolean {
- Line 487: .filter((item: any) => {
- Line 500: .map((item: any) => ({
- Line 507: .filter((item: any) => item.title && item.category && item.price > 0);

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/pdfImporter/schemaValidator.ts (5)
- Line 173: export function convertToDatabaseFormat(catalog: ParsedCatalog): any {
- Line 212: supabaseClient: any
- Line 213: ): Promise<{ success: boolean; result?: any; error?: string }> {
- Line 255: payload: any,
- Line 256: supabaseClient: any

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/retry.ts (5)
- Line 11: retryCondition?: (error: any) => boolean;
- Line 19: retryCondition: (error: any) => {
- Line 38: let lastError: any;
- Line 91: operation: () => Promise<{ data: T | null; error: any }>,
- Line 93: ): Promise<{ data: T | null; error: any }> {

### /Users/amaan/Downloads/servio-mvp-cleaned/components/ai/assistant-command-palette.tsx (5)
- Line 137: const retryPreviewPromises = retryData.plan.tools.map((tool: any) =>
- Line 162: const previewPromises = data.plan.tools.map(async (tool: any) => {
- Line 484: {result.topItems.slice(0, 5).map((item: any, i: number) => (
- Line 574: {preview.before.slice(0, 5).map((item: any, j: number) => (
- Line 592: {preview.after.slice(0, 5).map((item: any, j: number) => (

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/catalog/replace/route.ts (4)
- Line 200: async function replaceCatalog(supabase: any, venueId: string, fixedPayload: any, extractedText?: str
- Line 218: const itemsToInsert = fixedPayload.items.map((item: any, index: number) => ({
- Line 252: category_order: [...new Set(fixedPayload.items.map((item: any) => item.category))],
- Line 270: categories_created: [...new Set(itemsToInsert.map((item: any) => item.category))].length,

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/improvedMenuParser.ts (4)
- Line 104: } catch (jsonError: any) {
- Line 199: function convertToMenuPayload(parsed: any): MenuPayloadT {
- Line 201: const items = (parsed.items || []).map((item: any) => ({
- Line 210: const categories = [...new Set(items.map((item: any) => item.category).filter(Boolean))] as string[]

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/supabase/server.ts (4)
- Line 25: set(name: string, value: string, options: any) {
- Line 41: remove(name: string, options: any) {
- Line 71: set(name: string, value: string, options: any) { },
- Line 72: remove(name: string, options: any) { },

### /Users/amaan/Downloads/servio-mvp-cleaned/components/order-summary.tsx (4)
- Line 15: orderData?: any;
- Line 23: icon: any;
- Line 193: setOrder((prevOrder: any) => {
- Line 333: {order.items.map((item: any, index: number) => (

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/tables/[tableId]/route.ts (3)
- Line 14: const updateData: any = {
- Line 66: let ordersError: any = null;
- Line 109: let reservationsError: any = null;

### /Users/amaan/Downloads/servio-mvp-cleaned/app/dashboard/[venueId]/page.client.simple.tsx (3)
- Line 16: venue?: any;
- Line 19: initialCounts?: any;
- Line 20: initialStats?: any;

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/ai/assistant-llm.ts (3)
- Line 254: - warnings: any caveats or considerations (null if none)`;
- Line 449: params: any,
- Line 485: dataSummary: any

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/auth/utils.ts (3)
- Line 6: export function getOriginFromHeaders(h: any) {
- Line 38: export function handleAuthError(error: any): { message: string; code: string } {
- Line 76: export function validateSession(session: any): { isValid: boolean; error?: string } {

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/cache.ts (3)
- Line 65: async set(key: string, value: any, ttl = 3600): Promise<void> {
- Line 123: return values.map((v: any) => v ? JSON.parse(v) : null);
- Line 133: async mset(keyValues: Record<string, any>, ttl = 3600): Promise<void> {

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/monitoring/error-tracker.ts (3)
- Line 13: metadata?: Record<string, any>;
- Line 82: props?: Record<string, any>
- Line 244: details: Record<string, any>

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/monitoring/performance.ts (3)
- Line 172: memory?: any;
- Line 173: timing?: any;
- Line 174: navigation?: any;

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/monitoring.ts (3)
- Line 37: captureException(error: Error, context?: Record<string, any>) {
- Line 46: captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'error', context?: Record<stri
- Line 67: data?: Record<string, any>;

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/server/supabase.ts (3)
- Line 97: export function cookieAdapter(jar: any) {
- Line 102: set(name: string, value: string, options?: any) {
- Line 113: remove(name: string, options?: any) {

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/server-utils.ts (3)
- Line 10: export function hasSbAuthCookie(cookies: any) {
- Line 11: return cookies.getAll().some((c: any) => c.name.includes('-auth-token'))
- Line 21: return cookieStore.getAll().some((c: any) => c.name.includes('-auth-token'));

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/table-states.ts (3)
- Line 32: export function getTableState(table: any): TableStateInfo {
- Line 114: export function getMergeScenario(sourceTable: any, targetTable: any): MergeScenario {
- Line 250: export function getMergeableTables(sourceTable: any, availableTables: unknown[], showAllTables: bool

### /Users/amaan/Downloads/servio-mvp-cleaned/components/demo-ai-section.tsx (3)
- Line 23: const demoResponses: { [key: string]: any } = {
- Line 250: {response.preview.map((change: any, index: number) => (
- Line 347: {confirmedChanges.preview.map((change: any, index: number) => (

### /Users/amaan/Downloads/servio-mvp-cleaned/hooks/useDragAndDrop.ts (3)
- Line 14: [key: string]: any;
- Line 19: onReorder: (items: T[]) => Promise<{ success: boolean; error?: any }>
- Line 78: const handleDragUpdate = useCallback((update: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/hooks/useTableReservations.ts (3)
- Line 81: return tableData.map((item: any) => {
- Line 83: const activeSession = tableSessions.find((s: any) => s.table_id === item.id);
- Line 86: const tableReservations = reservations.filter((r: any) => r.table_id === item.id);

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/checkout/verify/route.ts (2)
- Line 27: set(name: string, value: string, options: any) { },
- Line 28: remove(name: string, options: any) { },

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/orders/route.ts (2)
- Line 88: async function createKDSTickets(supabase: any, order: any) {
- Line 147: const expoStation = existingStations.find((s: any) => s.station_type === 'expo') || existingStations

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/orders/session/[sessionId]/open/route.ts (2)
- Line 29: set(name: string, value: string, options: any) { },
- Line 30: remove(name: string, options: any) { },

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/pay/demo/route.ts (2)
- Line 27: set(name: string, value: string, options: any) { },
- Line 28: remove(name: string, options: any) { },

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/pay/later/route.ts (2)
- Line 27: set(name: string, value: string, options: any) { },
- Line 28: remove(name: string, options: any) { },

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/pay/stripe/route.ts (2)
- Line 27: set(name: string, value: string, options: any) { },
- Line 28: remove(name: string, options: any) { },

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/pay/till/route.ts (2)
- Line 27: set(name: string, value: string, options: any) { },
- Line 28: remove(name: string, options: any) { },

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/stripe/create-portal-session/route.ts (2)
- Line 105: } catch (configError: any) {
- Line 130: } catch (portalError: any) {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/stripe/webhooks/route.ts (2)
- Line 163: existingOrg: any,
- Line 164: supabase: any

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/tables/auto-create/route.ts (2)
- Line 27: set(name: string, value: string, options: any) { },
- Line 28: remove(name: string, options: any) { },

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/update-payment-status-pay-later/route.ts (2)
- Line 15: set(name: string, value: string, options: any) { },
- Line 16: remove(name: string, options: any) { },

### /Users/amaan/Downloads/servio-mvp-cleaned/app/auth/AuthProvider.tsx (2)
- Line 92: let subscription: any;
- Line 94: const { data } = supabase.auth.onAuthStateChange(async (event: any, newSession: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/complete-profile/form.tsx (2)
- Line 16: user: any;
- Line 33: const isOAuthUser = (user as any)?.identities?.some((identity: any) =>

### /Users/amaan/Downloads/servio-mvp-cleaned/app/dashboard/[venueId]/page.tsx (2)
- Line 94: const todayRevenue = (todayOrdersForRevenue ?? []).reduce((sum: number, order: any) => {
- Line 98: amount = order.items.reduce((s: number, it: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/order/page.tsx (2)
- Line 331: const result = supabase.auth.onAuthStateChange((_event: any, session: any) => {
- Line 394: const normalized = (data.menuItems || []).map((mi: any) => ({

### /Users/amaan/Downloads/servio-mvp-cleaned/app/order-summary/[orderId]/page.tsx (2)
- Line 145: const [feedbackResponses, setFeedbackResponses] = useState<Record<string, any>>({});
- Line 315: const handleFeedbackResponse = (questionId: string, response: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/ai/openai-service.ts (2)
- Line 114: content: any;
- Line 179: let toolResult: any;

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/csv.ts (2)
- Line 8: export interface CsvColumn<T extends Record<string, any>> {
- Line 35: export function toCSV<T extends Record<string, any>>(

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/pdfImporter/layoutParser.ts (2)
- Line 24: ): Promise<{ categories: ParsedCategory[], coverage: any }> {
- Line 508: ): any {

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/pdfImporter/processingModes.ts (2)
- Line 96: ): Promise<{ catalog: ParsedCatalog; coverage: CoverageReport; validation: any }> {
- Line 536: function validatePrecisionResults(categories: unknown[], priceTokens: PriceToken[]): any {

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/safeParse.ts (2)
- Line 9: export async function tryParseMenuWithGPT(raw: string): Promise<{ ok: boolean; parsed: any }> {
- Line 21: let parsed: any = {};

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/supabase/unified-client.ts (2)
- Line 129: set(name: string, value: string, options: any) {
- Line 142: remove(name: string, options: any) {

### /Users/amaan/Downloads/servio-mvp-cleaned/components/OrderFeedbackForm.tsx (2)
- Line 27: const [answers, setAnswers] = useState<{[key: string]: any}>({});
- Line 150: .subscribe((status: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/components/StyledMenuDisplay.tsx (2)
- Line 17: [key: string]: any; // Allow additional properties
- Line 24: onAddToCart: (item: any) => void;

### /Users/amaan/Downloads/servio-mvp-cleaned/components/UnifiedFeedbackForm.tsx (2)
- Line 34: const [answers, setAnswers] = useState<{[key: string]: any}>({});
- Line 132: const handleAnswerChange = (questionId: string, answer: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/components/analytics-dashboard.tsx (2)
- Line 117: (menuItems || []).forEach((mi: any) => {
- Line 356: }: any) => (

### /Users/amaan/Downloads/servio-mvp-cleaned/components/menu-management.tsx (2)
- Line 201: categories: [...new Set(data?.map((item: any) => item.category) || [])],
- Line 260: .subscribe((status: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/hooks/useTableOrders.ts (2)
- Line 66: (data || []).map(async (order: any) => {
- Line 122: const byStatus = data?.reduce((acc: Record<string, number>, order: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/admin/migrate-ai/page.tsx (1)
- Line 108: {migrationStatus.migrationStatus?.map((status: any, index: number) => (

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/ai/messages/route.ts (1)
- Line 256: } catch (aiError: any) {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/ai-assistant/conversations/route.ts (1)
- Line 117: const transformedConversations = (conversations || []).map((conv: any) => ({

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/checkout/route.ts (1)
- Line 54: items: JSON.stringify(items.map((item: any) => ({

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/dashboard/orders/[id]/route.ts (1)
- Line 25: const update: Record<string, any> = {};

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/dashboard/orders/route.ts (1)
- Line 148: const activeTablesToday = new Set(activeTables?.map((o: any) => o.table_number) || []).size;

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/extract-menu/route.ts (1)
- Line 12: const itemsToInsert = body.items.map((item: any) => ({

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/feedback/questions/route.ts (1)
- Line 197: const updateData: any = {};

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/inventory/export/movements/route.ts (1)
- Line 56: const rows = data?.map((movement: any) => [

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/inventory/import/csv/route.ts (1)
- Line 49: const row: any = {};

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/inventory/low-stock/route.ts (1)
- Line 49: affected_menu_items: menuItems?.map((mi: any) => mi.menu_item?.name).filter(Boolean) || [],

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/inventory/recipes/[menu_item_id]/route.ts (1)
- Line 32: const totalCost = data?.reduce((sum, item: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/kds/backfill/route.ts (1)
- Line 76: const expoStation = existingStations.find((s: any) => s.station_type === 'expo') || existingStations

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/kds/backfill-all/route.ts (1)
- Line 87: const expoStation = existingStations.find((s: any) => s.station_type === 'expo') || existingStations

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/kds/tickets/bulk-update/route.ts (1)
- Line 45: const updateData: any = { status };

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/kds/tickets/route.ts (1)
- Line 225: const updateData: any = { status };

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/menu/upload/route.ts (1)
- Line 63: const has = (buckets || []).some((b: any) => b.name === 'menus');

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/orders/update-payment-status/route.ts (1)
- Line 19: const updateData: any = {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/pos/orders/status/route.ts (1)
- Line 46: const updateData: any = { order_status };

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/pos/payments/route.ts (1)
- Line 58: const updateData: any = {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/staff/debug-invitations/route.ts (1)
- Line 22: const debugInfo: any = {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/staff/invitations/cancel/route.ts (1)
- Line 28: } catch (tableError: any) {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/staff/invitations/route.ts (1)
- Line 124: } catch (tableError: any) {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/subscription/refresh-status/route.ts (1)
- Line 122: } catch (stripeError: any) {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/api/table-sessions/[id]/route.ts (1)
- Line 14: const updateData: any = {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/auth/callback/page.tsx (1)
- Line 242: } catch (fallbackErr: any) {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/complete-profile/page.tsx (1)
- Line 31: const isOAuthUser = user.identities?.some((identity: any) =>

### /Users/amaan/Downloads/servio-mvp-cleaned/app/dashboard/[venueId]/analytics/AnalyticsClient.simple.tsx (1)
- Line 55: const totalRevenue = orders?.reduce((sum: number, order: any) => sum + (Number(order.total_amount) |

### /Users/amaan/Downloads/servio-mvp-cleaned/app/dashboard/[venueId]/billing/billing-client.tsx (1)
- Line 26: organization: any;

### /Users/amaan/Downloads/servio-mvp-cleaned/app/dashboard/[venueId]/feedback/SimpleFeedbackClient.tsx (1)
- Line 411: onValueChange={(value: any) => setFormData({ ...formData, type: value })}

### /Users/amaan/Downloads/servio-mvp-cleaned/app/dashboard/[venueId]/menu-management/MenuManagementClient.tsx (1)
- Line 451: } catch (bucketError: any) {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/home/page.tsx (1)
- Line 65: const result = supabase?.auth?.onAuthStateChange?.((event: any, session: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/app/invitation/[token]/InvitationAcceptanceClient.tsx (1)
- Line 28: permissions: any;

### /Users/amaan/Downloads/servio-mvp-cleaned/app/order-summary/page.tsx (1)
- Line 117: items: orderData.cart.map((item: any) => ({

### /Users/amaan/Downloads/servio-mvp-cleaned/app/order-tracking/[orderId]/page.tsx (1)
- Line 123: .subscribe((status: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/auth/supabase-callback.ts (1)
- Line 9: export async function handleGoogleCallback(req: any, res: any) {

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/cache/index.ts (1)
- Line 14: private memoryCache: Map<string, { value: any; expires: number }> = new Map();

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/cache/redis.ts (1)
- Line 202: async mset(items: Array<{ key: string; value: any; ttl?: number }>): Promise<boolean> {

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/getBaseUrl.ts (1)
- Line 18: const hdrs: any = h || headers();

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/image-utils.ts (1)
- Line 156: supabase: any,

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/logger/production-logger.ts (1)
- Line 18: [key: string]: any;

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/menuSchema.ts (1)
- Line 8: export function parsePriceAny(p: any) {

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/pdfImporter/gptPrompts.ts (1)
- Line 277: export function getPrompt(task: 'extract' | 'repair' | 'validate' | 'categorize' | 'deduplicate' | '

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/react-performance.ts (1)
- Line 75: export function deepEqual(a: any, b: any): boolean {

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/request-utils.ts (1)
- Line 110: executor: (resolve: (value: T) => void, reject: (reason?: any) => void, signal: AbortSignal) => void

### /Users/amaan/Downloads/servio-mvp-cleaned/lib/services/OrderService.ts (1)
- Line 192: const updates: any = { payment_status: paymentStatus };

### /Users/amaan/Downloads/servio-mvp-cleaned/components/MenuManagementWrapper.tsx (1)
- Line 9: session: any;

### /Users/amaan/Downloads/servio-mvp-cleaned/components/MenuPreview.tsx (1)
- Line 15: [key: string]: any; // Allow additional properties

### /Users/amaan/Downloads/servio-mvp-cleaned/components/PerformanceLink.tsx (1)
- Line 12: [key: string]: any;

### /Users/amaan/Downloads/servio-mvp-cleaned/components/TrialStatusBanner.tsx (1)
- Line 75: const processTrialStatus = (org: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/components/ai/contextual-assistant.tsx (1)
- Line 16: dataSummary?: any;

### /Users/amaan/Downloads/servio-mvp-cleaned/components/ai/production-chat-interface.tsx (1)
- Line 25: content: any;

### /Users/amaan/Downloads/servio-mvp-cleaned/components/demo-order-summary.tsx (1)
- Line 34: icon: any;

### /Users/amaan/Downloads/servio-mvp-cleaned/components/enhanced-feedback-system.tsx (1)
- Line 140: filteredFeedback = filteredFeedback.filter((f: any) =>

### /Users/amaan/Downloads/servio-mvp-cleaned/components/inventory/ImportCSVDialog.tsx (1)
- Line 108: {result.errors.map((err: any, i: number) => (

### /Users/amaan/Downloads/servio-mvp-cleaned/components/inventory/RecipeDialog.tsx (1)
- Line 68: const mappedRecipe = result.data.map((item: any) => ({

### /Users/amaan/Downloads/servio-mvp-cleaned/components/real-time-order-timeline.tsx (1)
- Line 152: .subscribe((status: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/hooks/use-auth.ts (1)
- Line 91: async (event: any, session: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/hooks/useCounterOrders.ts (1)
- Line 90: const byStatus = data?.reduce((acc: Record<string, number>, order: any) => {

### /Users/amaan/Downloads/servio-mvp-cleaned/hooks/useEnhancedTableMerge.ts (1)
- Line 26: data?: any;

### /Users/amaan/Downloads/servio-mvp-cleaned/hooks/useLiveOrders.ts (1)
- Line 87: const transformedOrders = (data ?? []).map((order: any) => ({

### /Users/amaan/Downloads/servio-mvp-cleaned/hooks/useTableRealtime.ts (1)
- Line 48: .subscribe((status: any) => {

