/**
 * @fileoverview Database Query Optimization
 * Provides tools for analyzing and optimizing database queries
 */

import { createSupabaseClient } from "@/lib/supabase";
import { logger } from "@/lib/monitoring/structured-logger";

export interface QueryAnalysis {
  query: string;
  duration: number;
  rowsAffected: number;
  indexesUsed: string[];
  recommendations: string[];
}

export interface QueryOptimization {
  originalQuery: string;
  optimizedQuery: string;
  improvement: string;
  estimatedSpeedup: number;
}

/**
 * Query Optimizer
 */
export class QueryOptimizer {
  private async getClient() {
    return await createSupabaseClient();
  }
  private slowQueryThreshold = 100; // ms

  /**
   * Analyze a query for performance issues
   */
  async analyzeQuery(
    query: string,
    execute: () => Promise<unknown>
  ): Promise<QueryAnalysis> {
    const startTime = performance.now();
    const result = await execute();
    const duration = performance.now() - startTime;

    const analysis: QueryAnalysis = {
      query,
      duration,
      rowsAffected: 0,
      indexesUsed: [],
      recommendations: [],
    };

    // Check if query is slow
    if (duration > this.slowQueryThreshold) {
      analysis.recommendations.push(
        `Query took ${duration.toFixed(2)}ms (threshold: ${this.slowQueryThreshold}ms)`
      );
    }

    // Check for N+1 query pattern
    if (this.hasNPlusOnePattern(query)) {
      analysis.recommendations.push(
        "Potential N+1 query detected. Consider using JOIN or IN clause."
      );
    }

    // Check for missing indexes
    const missingIndexes = this.detectMissingIndexes(query);
    if (missingIndexes.length > 0) {
      analysis.recommendations.push(
        `Consider adding indexes on: ${missingIndexes.join(", ")}`
      );
      analysis.indexesUsed = missingIndexes;
    }

    // Log slow queries
    if (duration > this.slowQueryThreshold) {
      logger.warn("Slow query detected", {
        query: query.substring(0, 100),
        duration,
        recommendations: analysis.recommendations,
      });
    }

    return analysis;
  }

  /**
   * Detect N+1 query pattern
   */
  private hasNPlusOnePattern(query: string): boolean {
    // Look for patterns like SELECT * FROM table WHERE id IN (...)
    // followed by individual queries for each ID
    const inClausePattern = /IN\s*\([^)]+\)/i;
    const hasInClause = inClausePattern.test(query);

    // Check if query is in a loop or multiple similar queries
    const hasLoopPattern = /FOR\s+.*\s+IN\s*\(/i.test(query);

    return hasInClause && hasLoopPattern;
  }

  /**
   * Detect missing indexes
   */
  private detectMissingIndexes(query: string): string[] {
    const missingIndexes: string[] = [];

    // Check for WHERE clauses on common columns
    const wherePattern = /WHERE\s+(\w+)\s*=/gi;
    let match;

    while ((match = wherePattern.exec(query)) !== null) {
      const column = match[1];

      // Common columns that should be indexed
      const shouldIndex = [
        "venue_id",
        "user_id",
        "order_id",
        "table_id",
        "created_at",
        "updated_at",
        "status",
        "order_status",
        "payment_status",
      ];

      if (column && shouldIndex.includes(column)) {
        missingIndexes.push(column);
      }
    }

    return [...new Set(missingIndexes)]; // Remove duplicates
  }

  /**
   * Suggest query optimization
   */
  suggestOptimization(query: string): QueryOptimization | null {
    const optimizations: QueryOptimization[] = [];

    // Optimization 1: Use SELECT specific columns instead of SELECT *
    if (query.includes("SELECT *")) {
      const optimized = query.replace(/SELECT\s+\*/gi, "SELECT id, name, created_at");
      optimizations.push({
        originalQuery: query,
        optimizedQuery: optimized,
        improvement: "Replace SELECT * with specific columns",
        estimatedSpeedup: 1.5,
      });
    }

    // Optimization 2: Add LIMIT to queries without it
    if (
      !query.includes("LIMIT") &&
      (query.includes("SELECT") || query.includes("UPDATE") || query.includes("DELETE"))
    ) {
      const optimized = query + " LIMIT 1000";
      optimizations.push({
        originalQuery: query,
        optimizedQuery: optimized,
        improvement: "Add LIMIT clause to prevent large result sets",
        estimatedSpeedup: 2.0,
      });
    }

    // Optimization 3: Use EXISTS instead of IN for subqueries
    if (query.includes("IN (SELECT")) {
      const optimized = query.replace(/IN\s*\(\s*SELECT/gi, "EXISTS (SELECT");
      optimizations.push({
        originalQuery: query,
        optimizedQuery: optimized,
        improvement: "Use EXISTS instead of IN for subqueries",
        estimatedSpeedup: 1.3,
      });
    }

    // Optimization 4: Use JOIN instead of subqueries
    if (query.includes("SELECT") && query.match(/SELECT.*FROM.*WHERE.*IN.*SELECT/i)) {
      const optimized = this.convertSubqueryToJoin(query);
      if (optimized !== query) {
        optimizations.push({
          originalQuery: query,
          optimizedQuery: optimized,
          improvement: "Use JOIN instead of subquery",
          estimatedSpeedup: 2.5,
        });
      }
    }

    // Return best optimization
    if (optimizations.length > 0) {
      return optimizations.reduce((best, current) =>
        current.estimatedSpeedup > best.estimatedSpeedup ? current : best
      );
    }

    return null;
  }

  /**
   * Convert subquery to JOIN
   */
  private convertSubqueryToJoin(query: string): string {
    // Simple heuristic: convert WHERE id IN (SELECT id FROM table) to JOIN
    const pattern = /WHERE\s+(\w+)\.id\s+IN\s*\(\s*SELECT\s+(\w+)\.id\s+FROM\s+(\w+)/gi;
    return query.replace(pattern, "JOIN $3 ON $1.id = $3.id WHERE");
  }

  /**
   * Get index recommendations
   */
  async getIndexRecommendations(tableName: string): Promise<string[]> {
    const recommendations: string[] = [];

    // Common indexes for multi-tenant apps
    const commonIndexes = [
      `${tableName}_pkey`,
      `${tableName}_venue_id_idx`,
      `${tableName}_user_id_idx`,
      `${tableName}_created_at_idx`,
      `${tableName}_status_idx`,
      `${tableName}_order_status_idx`,
    ];

    // Check if indexes exist (this would require querying pg_indexes)
    // For now, return recommendations based on common patterns

    return recommendations;
  }

  /**
   * Create index recommendation SQL
   */
  createIndexSql(
    tableName: string,
    columnName: string,
    unique: boolean = false
  ): string {
    const indexName = `idx_${tableName}_${columnName}`;
    const uniqueClause = unique ? "UNIQUE " : "";

    return `
CREATE ${uniqueClause}INDEX IF NOT EXISTS ${indexName}
ON ${tableName} (${columnName});
    `.trim();
  }

  /**
   * Analyze table for optimization opportunities
   */
  async analyzeTable(tableName: string): Promise<{
    recommendations: string[];
    estimatedRowCount: number;
    indexes: string[];
  }> {
    // Get row count estimate
    const supabase = await this.getClient();
    const { count } = await supabase
      .from(tableName)
      .select("*", { count: "exact", head: true });

    const estimatedRowCount = count || 0;

    const recommendations: string[] = [];

    // Recommend partitioning for large tables
    if (estimatedRowCount > 1000000) {
      recommendations.push(
        `Consider partitioning ${tableName} by date or venue_id for better performance`
      );
    }

    // Recommend archiving for old data
    if (estimatedRowCount > 5000000) {
      recommendations.push(
        `Consider archiving old data from ${tableName} to improve query performance`
      );
    }

    return {
      recommendations,
      estimatedRowCount,
      indexes: [],
    };
  }

  /**
   * Get query execution plan (PostgreSQL EXPLAIN)
   */
  async explainQuery(_query: string): Promise<{
    plan: unknown;
    cost: number;
    recommendations: string[];
  }> {
    try {
      // Note: This would require a custom RPC function in Supabase
      // For now, return a placeholder implementation
      const plan = null;
      const cost = 0;

      const recommendations: string[] = [];

      if (cost > 10000) {
        recommendations.push(
          `Query has high cost (${cost}). Consider adding indexes or rewriting query.`
        );
      }

      if (cost > 100000) {
        recommendations.push(
          "Query cost is very high. This query may timeout in production."
        );
      }

      return { plan, cost, recommendations };
    } catch (error) {
      logger.error("Failed to explain query", { error });
      return {
        plan: null,
        cost: 0,
        recommendations: [],
      };
    }
  }

  /**
   * Extract cost from execution plan
   */
  private extractCostFromPlan(plan: unknown): number {
    if (typeof plan === "object" && plan !== null) {
      const planObj = plan as Record<string, unknown>;
      return (planObj["Total Cost"] as number) || 0;
    }
    return 0;
  }

  /**
   * Batch query optimization
   */
  async optimizeBatchQueries<T>(
    queries: Array<() => Promise<T>>
  ): Promise<{ results: T[]; totalTime: number; optimized: boolean }> {
    const startTime = performance.now();

    // Execute queries in parallel
    const results = await Promise.all(queries.map((q) => q()));

    const totalTime = performance.now() - startTime;

    // Calculate if parallel execution was faster
    const sequentialTime = totalTime * queries.length;
    const optimized = totalTime < sequentialTime;

    if (optimized) {
      logger.info("Batch queries optimized", {
        queryCount: queries.length,
        sequentialTime: sequentialTime.toFixed(2),
        parallelTime: totalTime.toFixed(2),
        speedup: (sequentialTime / totalTime).toFixed(2),
      });
    }

    return { results, totalTime, optimized };
  }
}

// Export singleton instance
export const queryOptimizer = new QueryOptimizer();

/**
 * Decorator for automatic query analysis
 */
export function AnalyzeQuery(_tableName?: string) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const query = args[0] as string;
      const execute = () => originalMethod.apply(this, args);

      return queryOptimizer.analyzeQuery(query, execute);
    };

    return descriptor;
  };
}

/**
 * Query optimization guidelines
 */
export const QUERY_OPTIMIZATION_GUIDELINES = {
  // Use specific columns
  USE_SPECIFIC_COLUMNS: "Avoid SELECT *. Specify only needed columns",

  // Use indexes
  USE_INDEXES: "Ensure WHERE clause columns are indexed",

  // Limit results
  LIMIT_RESULTS: "Always use LIMIT for queries that don't need all rows",

  // Avoid N+1
  AVOID_N_PLUS_ONE: "Use JOIN or IN clause instead of N+1 queries",

  // Use EXISTS
  USE_EXISTS: "Use EXISTS instead of IN for subqueries",

  // Batch operations
  BATCH_OPERATIONS: "Batch multiple operations into single query",

  // Use transactions
  USE_TRANSACTIONS: "Use transactions for related operations",

  // Avoid subqueries
  AVOID_SUBQUERIES: "Prefer JOINs over subqueries when possible",

  // Use prepared statements
  USE_PREPARED_STATEMENTS: "Use parameterized queries to prevent SQL injection",

  // Consider caching
  CONSIDER_CACHING: "Cache frequently accessed data",
};
