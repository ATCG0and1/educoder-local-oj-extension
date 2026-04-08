# Educoder 任务树搜索/筛选 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add keyword filtering to the task tree with subtree-preserving match semantics and auto-expanded filtered results.

**Architecture:** Keep filtering state inside `TaskTreeProvider`, expose tree-title commands to set/clear the filter, and prune the in-memory catalog before tree-node rendering.
