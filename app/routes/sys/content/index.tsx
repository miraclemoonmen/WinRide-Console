import { useLatestRequest } from "~/hooks/useLatestRequest";
import {
  Badge,
  Button,
  DatePicker,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  type TableProps,
} from "antd";
import { DeleteOutlined, EyeOutlined, UndoOutlined } from "@ant-design/icons";
import { useState } from "react";
import {
  useLoaderData,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "react-router";
import type { Route } from "./+types";
import { useTableQuery } from "~/hooks/useTableQuery";
import {
  deleteManagedContent,
  getManagedContent,
  getManagedContents,
  restoreManagedContent,
  type ContentType,
} from "~/services/content";
import { requireApiSuccess } from "~/services/http";
import type { ManagedContent } from "~/types/api";
import { getErrorMessage, isFormValidationError } from "~/utils/errors";
import { formatDateTime } from "~/utils/date";
import ContentDetailsDrawer from "./components/ContentDetailsDrawer";
import {
  CONTENT_DELETE_SOURCE_LABELS,
  CONTENT_STATUS_LABELS,
} from "~/constants/content";

const { RangePicker } = DatePicker;
interface FilterForm extends Record<string, unknown> {
  keyword?: string;
  deleted?: string;
  status?: string;
  createdAtRange?: unknown[];
}

interface DeleteForm {
  reason: string;
}

function contentType(url: URL): ContentType {
  return url.searchParams.get("type") === "comments" ? "comments" : "posts";
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const type = contentType(url);
  const params = new URLSearchParams(url.searchParams);
  params.delete("type");
  if (!params.has("deleted")) params.set("deleted", "false");
  const result = await getManagedContents(type, `?${params.toString()}`);
  if (result.code !== 0) {
    throw new Response(result.msg || "内容列表加载失败", { status: 500 });
  }
  return { type, data: requireApiSuccess(result) };
}

export default function ContentManagementPage() {
  const { run: loadDetail, cancel: cancelDetail } = useLatestRequest();
  const { type, data } = useLoaderData<typeof clientLoader>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const [detail, setDetail] = useState<ManagedContent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManagedContent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteForm] = Form.useForm<DeleteForm>();
  const {
    form: filterForm,
    initialValues,
    handleSearch,
    handleReset,
    onPageChange,
  } = useTableQuery<FilterForm>({
    pageSize: data.size,
    dateFields: ["createdAtRange"],
  });

  const openDetail = async (record: ManagedContent) => {
    try {
      const result = await loadDetail(signal =>
        getManagedContent(type, record.id, signal),
      );
      if (!result) return;
      setDetail(requireApiSuccess(result));
      setDetailOpen(true);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "详情加载失败"));
    }
  };

  const confirmRestore = (record: ManagedContent) => {
    Modal.confirm({
      title: `恢复这条${type === "posts" ? "帖子" : "评论"}？`,
      content:
        record.status === -1
          ? "恢复后内容会重新进入待审核队列，不会直接公开。"
          : "恢复后将重新出现在对应内容区域。",
      okText: "确认恢复",
      cancelText: "取消",
      onOk: async () => {
        try {
          const result = await restoreManagedContent(type, record.id);
          if (result.code !== 0) throw new Error(result.msg || "恢复失败");
          message.success("内容已恢复");
          await revalidator.revalidate();
        } catch (error: unknown) {
          message.error(getErrorMessage(error, "恢复失败，请稍后重试"));
          throw error;
        }
      },
    });
  };

  const columns: TableProps<ManagedContent>["columns"] = [
    {
      title: type === "posts" ? "标题" : "评论内容",
      key: "summary",
      ellipsis: true,
      render: (_, record) => record.title || record.content || "（无文本内容）",
    },
    { title: "作者", dataIndex: "authorName", width: 130 },
    ...(type === "comments"
      ? [
          {
            title: "所属帖子",
            dataIndex: "postTitle",
            width: 190,
            ellipsis: true,
          },
        ]
      : [{ title: "评论数", dataIndex: "commentCount", width: 90 }]),
    {
      title: "内容状态",
      dataIndex: "status",
      width: 110,
      render: (value: number) => (
        <Tag>{CONTENT_STATUS_LABELS[value] || value}</Tag>
      ),
    },
    {
      title: "删除状态",
      key: "deleted",
      width: 120,
      render: (_, record) =>
        record.deletedAt ? (
          <Badge
            status="error"
            text={
              CONTENT_DELETE_SOURCE_LABELS[record.deleteSource || ""] ||
              "历史删除"
            }
          />
        ) : (
          <Badge status="success" text="正常" />
        ),
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      width: 190,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: "操作",
      key: "actions",
      width: 130,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => void openDetail(record)}
            aria-label="查看详情"
            title="查看详情"
          />
          {!record.deletedAt && (
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => {
                setDeleteTarget(record);
                deleteForm.resetFields();
              }}
              aria-label="删除内容"
              title="删除"
            />
          )}
          {record.deletedAt && record.canRestore && (
            <Button
              type="text"
              size="small"
              icon={<UndoOutlined />}
              onClick={() => confirmRestore(record)}
              aria-label="恢复内容"
              title="恢复"
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">内容管理</h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-gray-400">
          管理帖子与评论的可见状态；软删除内容可按原删除批次安全恢复。
        </p>
      </div>
      <section className="rounded-3xl border border-gray-50 bg-white p-5 shadow-sm">
        <Tabs
          activeKey={type}
          onChange={key => {
            const next = new URLSearchParams(searchParams);
            next.set("type", key);
            next.set("page", "1");
            setSearchParams(next);
          }}
          items={[
            { key: "posts", label: "帖子" },
            { key: "comments", label: "评论" },
          ]}
        />
        <header className="mb-4 flex items-start justify-between gap-4">
          <Form
            form={filterForm}
            layout="inline"
            initialValues={{ deleted: "false", ...initialValues }}
            onValuesChange={(_, values) => handleSearch({ ...values, type })}
          >
            <Form.Item name="keyword">
              <Input
                allowClear
                placeholder="标题、正文或作者"
                style={{ width: 220 }}
              />
            </Form.Item>
            <Form.Item name="deleted">
              <Select
                style={{ width: 120 }}
                options={[
                  { value: "false", label: "正常" },
                  { value: "true", label: "已删除" },
                ]}
              />
            </Form.Item>
            <Form.Item name="status">
              <Select
                allowClear
                placeholder="内容状态"
                style={{ width: 130 }}
                options={[
                  { value: "-1", label: "审核中" },
                  { value: "0", label: "已发布" },
                  { value: "1", label: "需修改" },
                ]}
              />
            </Form.Item>
            <Form.Item name="createdAtRange">
              <RangePicker />
            </Form.Item>
          </Form>
          <Button
            onClick={() => {
              handleReset();
              setSearchParams({ type, deleted: "false" }, { replace: true });
            }}
          >
            重置
          </Button>
        </header>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data.list}
          loading={{ spinning: navigation.state === "loading", delay: 150 }}
          scroll={{ x: 1050, y: "calc(100vh - 420px)" }}
          pagination={{
            current: data.page,
            pageSize: data.size,
            total: data.total,
            showSizeChanger: true,
            pageSizeOptions: ["20", "40", "80"],
            onChange: onPageChange,
          }}
        />
      </section>

      <ContentDetailsDrawer
        detail={detail}
        open={detailOpen}
        onClose={() => {
          cancelDetail();
          setDetailOpen(false);
        }}
        onAfterClose={() => setDetail(null)}
      />

      <Modal
        title={`确认删除这条${type === "posts" ? "帖子" : "评论"}？`}
        open={deleteTarget !== null}
        okText="确认删除"
        cancelText="返回检查"
        okButtonProps={{ danger: true }}
        confirmLoading={submitting}
        onCancel={() => setDeleteTarget(null)}
        onOk={async () => {
          if (!deleteTarget) return;
          try {
            const values = await deleteForm.validateFields();
            setSubmitting(true);
            const result = await deleteManagedContent(
              type,
              deleteTarget.id,
              values.reason.trim(),
            );
            if (result.code !== 0) throw new Error(result.msg || "删除失败");
            message.success("内容已删除，可在已删除筛选中恢复");
            setDeleteTarget(null);
            deleteForm.resetFields();
            await revalidator.revalidate();
          } catch (error: unknown) {
            if (!isFormValidationError(error)) {
              message.error(getErrorMessage(error, "删除失败，请稍后重试"));
            }
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <p className="mb-4 text-sm text-gray-500">
          删除会立即隐藏内容，但会保留业务关系与图片，以便后续恢复。
        </p>
        <Form form={deleteForm} layout="vertical">
          <Form.Item
            name="reason"
            label="删除原因"
            rules={[
              { required: true, whitespace: true, message: "请填写删除原因" },
              { max: 500, message: "删除原因不能超过 500 个字符" },
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={500}
              showCount
              placeholder="说明删除依据，操作日志会保留这次记录"
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
