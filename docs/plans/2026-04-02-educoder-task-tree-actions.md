# Educoder 任务树当前态与右键菜单 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add current-task highlighting and task-node context actions to the Educoder task tree.

**Architecture:** Extend `TaskTreeProvider` with a lightweight current-task state and visible marker, then add wrapper commands for tree-node context menu actions so existing task commands can be reused without changing their taskRoot-first API.

**Tech Stack:** TypeScript, VS Code Tree View + menus API, existing task commands, Vitest.
