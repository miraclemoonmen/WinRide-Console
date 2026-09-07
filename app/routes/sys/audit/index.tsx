import { useLatestRequest } from "~/hooks/useLatestRequest";
import {
  Badge,
  Button,
  DatePicker,
  Flex,
  Form,
  Input,
  message,
  Modal,
  Select,
  Table,
  type TableProps,
} from "antd";
const { RangePicker } = DatePicker;
import { useTableQuery } from "~/hooks/useTableQuery";
import { useLoaderData, useNavigation, useRevalidator } from "react-router";
import { EyeOutlined } from "@ant-design/icons";
import type { Route } from "./+types";
import {
  decideAudit,
  getAuditRecord,
  getCommentAuditDetail,
  getPostAuditDetail,
} from "~/services/audit";
import { useState } from "react";
import AuditDetailsDrawer from "~/routes/sys/audit/components/AuditDetailsDrawer";
import { requireApiSuccess } from "~/services/http";
import type { AuditRecord, CommentRecord, PostRecord } from "~/types/api";
import { isFormValidationError } from "~/utils/errors";
import { formatDateTime } from "~/utils/date";

interface SelectedPostAudit {
  auditId: number;
  status: number;
  detail: PostRecord | CommentRecord;
  auditMeta: AuditRecord;
}

interface AuditQueryForm extends Record<string, unknown> {
  status?: string;
  createdAtRange?: unknown[];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const result = await getAuditRecord(url.search);
  if (result.code !== 0) {
    throw new Response(result.msg || "审核列表加载失败", { status: 500 });
  }
  return requireApiSuccess(result);
}

export default function Index() {
  const { run: loadDetail, cancel: cancelDetail } = useLatestRequest();
  const [selectedPostAudit, setSelectedPostAudit] =
    useState<SelectedPostAudit | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectForm] = Form.useForm();
  const revalidator = useRevalidator();

  const openAuditDetail = async (record: AuditRecord) => {
    try {
      const detail = await loadDetail<SelectedPostAudit["detail"]>(
        async signal =>
          record.bizType === 1
            ? requireApiSuccess(await getPostAuditDetail(record.bizId, signal))
            : requireApiSuccess(
                await getCommentAuditDetail(record.bizId, signal),
              ),
      );
      if (!detail) return;
      setSelectedPostAudit({
        auditId: record.id,
        status: record.status,
        detail,
        auditMeta: record,
      });
    } catch {
      message.error(
        `${record.bizType === 1 ? "帖子" : "评论"}详情加载失败，请稍后重试`,
      );
    }
  };

  const handleReject = async () => {
    if (rejectingId == null) return;
    try {
      const values = await rejectForm.validateFields();
      setRejectLoading(true);
      const { code, msg } = await decideAudit(rejectingId, {
        decision: "REJECT",
        reasonCode: values.reasonCode,
        note: values.note?.trim() || undefined,
      });
      if (code === 0) {
        message.success(msg || "已驳回");
        setRejectingId(null);
        setSelectedPostAudit(null);
        rejectForm.resetFields();
        await revalidator.revalidate();
      } else {
        message.error(msg || "驳回失败");
      }
    } catch (error: unknown) {
      if (!isFormValidationError(error)) {
        message.error("驳回失败，请稍后重试");
      }
    } finally {
      setRejectLoading(false);
    }
  };

  const columns: TableProps<AuditRecord>["columns"] = [
    {
      title: "发布者",
      dataIndex: "creator",
    },
    {
      title: "类型",
      dataIndex: "bizType",
      render: bizType => {
        switch (bizType) {
          case 1:
            return "帖子";
          case 2:
            return "评论";
          default:
            return "图片";
        }
      },
    },
    {
      title: "命中关键词",
      dataIndex: "hitKeywords",
      render: hitKeywords => hitKeywords?.join(",") ?? "-",
    },
    {
      title: "执行结果",
      dataIndex: "status",
      render: (_, record) => {
        switch (record.status) {
          case -1:
            return <Badge status="processing" text="待审核" />;
          case 0:
            return <Badge status="success" text="已通过" />;
          case 1:
            return <Badge status="error" text="已驳回" />;
          default:
            return <Badge status="default" text="已取消" />;
        }
      },
    },
    {
      title: "时间",
      dataIndex: "createdAt",
      render: (value: string) => formatDateTime(value),
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => {
        switch (record.bizType) {
          case 1:
          case 2:
            return (
              <Button
                onClick={() => void openAuditDetail(record)}
                size="small"
                type="text"
                icon={<EyeOutlined />}
                aria-label={`查看${record.bizType === 1 ? "帖子" : "评论"}审核详情`}
                title="查看详情"
              />
            );
          case 3:
            return (
              <Button
                href={`/console/files/view/${record.bizId}`}
                target="_blank"
                size="small"
                type="text"
                icon={<EyeOutlined />}
                aria-label="查看待审核图片"
                title="查看图片"
              />
            );
        }
      },
    },
  ];
  const data = useLoaderData<typeof clientLoader>();

  const navigation = useNavigation();
  const { form, initialValues, handleSearch, handleReset, onPageChange } =
    useTableQuery<AuditQueryForm>({
      pageSize: data.size,
      dateFields: ["createdAtRange"],
    });

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">审核</h2>
        <p className="text-sm text-gray-400 mt-1.5 leading-relaxed max-w-3xl">
          在公开前需经过系统核准。
        </p>
      </div>
      <section className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50">
        <header className="flex justify-between mb-4">
          <Form
            form={form}
            layout="inline"
            initialValues={initialValues}
            onValuesChange={(_, allValues) => {
              handleSearch(allValues);
            }}
          >
            <Form.Item name="status">
              <Select
                placeholder="状态"
                style={{ width: 120 }}
                allowClear
                options={[
                  { value: "-1", label: "待审核" },
                  { value: "0", label: "已通过" },
                  { value: "1", label: "已驳回" },
                  { value: "2", label: "已取消" },
                ]}
              />
            </Form.Item>
            <Form.Item name="createdAtRange">
              <RangePicker />
            </Form.Item>
          </Form>
          <Flex gap="small" wrap>
            <Button onClick={handleReset}>重置</Button>
          </Flex>
        </header>
        <Table
          loading={{
            spinning: navigation.state === "loading",
            delay: 150,
            size: "large",
          }}
          scroll={{ y: "calc(100vh - 386px)" }}
          columns={columns}
          dataSource={data.list}
          rowKey="id"
          pagination={{
            current: data.page,
            pageSize: data.size,
            total: data.total,
            showSizeChanger: true,
            pageSizeOptions: ["20", "40"],
            showQuickJumper: true,
            onChange: (p, ps) => onPageChange(p, ps),
          }}
        />
        {selectedPostAudit && (
          <AuditDetailsDrawer
            auditId={selectedPostAudit?.auditId ?? -1}
            status={selectedPostAudit?.status ?? null}
            record={selectedPostAudit.detail}
            auditMeta={selectedPostAudit.auditMeta}
            open
            onClose={() => {
              cancelDetail();
              setSelectedPostAudit(null);
            }}
            onApproved={async () => {
              setSelectedPostAudit(null);
              await revalidator.revalidate();
            }}
            onRejectRequest={() => {
              if (selectedPostAudit) setRejectingId(selectedPostAudit.auditId);
            }}
          />
        )}
        <Modal
          title="驳回审核"
          open={rejectingId !== null}
          okText="确认驳回"
          cancelText="取消"
          okButtonProps={{ danger: true, loading: rejectLoading }}
          onOk={handleReject}
          onCancel={() => {
            setRejectingId(null);
            rejectForm.resetFields();
          }}
        >
          <Form form={rejectForm} layout="vertical" className="mt-5">
            <Form.Item
              name="reasonCode"
              label="驳回原因"
              rules={[{ required: true, message: "请选择驳回原因" }]}
            >
              <Select
                placeholder="选择原因"
                options={[
                  { value: "SENSITIVE_TEXT", label: "文字内容不合规" },
                  { value: "IMAGE_RISK", label: "图片内容不合规" },
                  { value: "ADVERTISING", label: "广告或推广内容" },
                  { value: "IRRELEVANT", label: "内容与主题无关" },
                  { value: "OTHER", label: "其他原因" },
                ]}
              />
            </Form.Item>
            <Form.Item noStyle dependencies={["reasonCode"]}>
              {({ getFieldValue }) => (
                <Form.Item
                  name="note"
                  label="给发布者的说明"
                  rules={
                    getFieldValue("reasonCode") === "OTHER"
                      ? [
                          {
                            required: true,
                            message: "选择其他原因时请填写说明",
                          },
                        ]
                      : []
                  }
                >
                  <Input.TextArea
                    rows={4}
                    maxLength={500}
                    showCount
                    placeholder="说明需要修改的具体内容，发布者将看到这段文字"
                  />
                </Form.Item>
              )}
            </Form.Item>
          </Form>
        </Modal>
      </section>
    </>
  );
}
