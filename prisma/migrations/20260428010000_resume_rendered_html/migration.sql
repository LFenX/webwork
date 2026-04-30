-- AlterTable: 存储已构建的简历 HTML，避免每次展示页都重新渲染第三方主题
ALTER TABLE "Resume" ADD COLUMN "renderedHtml" TEXT;
ALTER TABLE "Resume" ADD COLUMN "lastBuiltAt" TIMESTAMP(3);
ALTER TABLE "Resume" ADD COLUMN "lastBuiltTheme" TEXT;
