import { useLatestRequest } from "~/hooks/useLatestRequest";
import {
  Badge,
  Button,
  Descriptions,
  DatePicker,
  Form,
  Input,
  message,
  Modal,
  Select,
  Table,
  Tag,
  type TableProps,
} from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useLoaderData, useNavigation, useRevalidator } from "react-router";
import { requireApiSuccess } from "~/services/http";
import { useState } from "react";
import type { Route } from "./+types";
import { useTableQuery } from "~/hooks/useTableQuery";
import { decideReport, getReport, getReports } from "~/services/report";
import type { ReportRecord } from "~/types/api";
import { getErrorMessage, isFormValidationError } from "~/utils/errors";
import { formatDateTime } from "~/utils/date";

const { RangePicker } = DatePicker;

const TYPE_LABELS: Record<ReportRecord["targetType"], string> = {
  POST: "帖子",
  COMMENT: "评论",
  USER: "用户",
};
const REASON_LABELS: Record<string, string> = {
  SPAM: "广告或垃圾信息",
  ABUSE: "辱骂或骚扰",
  PORNOGRAPHY: "色情低俗",
  PRIVACY: "侵犯隐私",
  ILLEGAL: "违法违规",
  OTHER: "其他问题",
};
const ACTION_LABELS: Record<string, string> = {
  NONE: "未执行处置",
  REMOVE_CONTENT: "下架内容",
  DISABLE_USER: "禁用账号",
};

type ReportAction = "NONE" | "REMOVE_CONTENT" | "DISABLE_USER";
interface ReportDecisionForm {
  decision: "RESOLVE" | "DISMISS";
  action: ReportAction;
  reviewNote?: string;
}
interface ReportQueryForm extends Record<string, unknown> {
  status?: string;
  targetType?: string;
  reasonCode?: string;
  createdAtRange?: unknown[];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const result = await getReports(new URL(request.url).search);
  if (result.code !== 0) {
    throw new Response(result.msg || "举报列表加载失败", { status: 500 });
  }
  return requireApiSuccess(result);
}

export default function ReportWorkbench() {
  const { run: loadDetail, cancel: cancelDetail } = useLatestRequest();
  const data = useLoaderData<typeof clientLoader>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [selected, setSelected] = useState<ReportRecord | null>(null);
  const [handling, setHandling] = useState(false);
  const [form] = Form.useForm<ReportDecisionForm>();
  const {
    form: filterForm,
    initialValues,
    handleSearch,
    handleReset,
    onPageChange,
  } = useTableQuery<ReportQueryForm>({
    pageSize: data.size,
    dateFields: ["createdAtRange"],
  });

  const confirmDestructiveAction = (action: ReportAction) =>
    new Promise<boolean>(resolve => {
      if (!["REMOVE_CONTENT", "DISABLE_USER"].includes(action)) {
        resolve(true);
        return;
      }
      Modal.confirm({
        title: action === "DISABLE_USER" ? "确认禁用账号？" : "确认下架内容？",
        content:
          action === "DISABLE_USER"
            ? "禁用后该用户将无法继续使用账号，其公开内容也会被隐藏。"
            : "下架后该内容将不再对用户可见。",
        okText: action === "DISABLE_USER" ? "确认禁用" : "确认下架",
        cancelText: "返回检查",
        okButtonProps: { danger: true },
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

  const submit = async () => {
    if (!selected) return;
    try {
      const values = await form.validateFields();
      const action = values.decision === "DISMISS" ? "NONE" : values.action;
      if (!(await confirmDestructiveAction(action))) return;
      setHandling(true);
      const result = await decideReport(selected.id, {
        decision: values.decision,
        action,
        reviewNote: values.reviewNote?.trim() || undefined,
      });
      if (result.code !== 0) throw new Error(result.msg || "处理失败");
      message.success("举报已处理");
      setSelected(null);
      form.resetFields();
      await revalidator.revalidate();
    } catch (error: unknown) {
      if (!isFormValidationError(error)) {
        message.error(getErrorMessage(error, "处理失败，请稍后重试"));
      }
    } finally {
      setHandling(false);
    }
  };

  const columns: TableProps<ReportRecord>["columns"] = [
    { title: "举报人", dataIndex: "reporterName", width: 130 },
    {
      title: "对象",
      dataIndex: "targetType",
      width: 90,
      render: (value: ReportRecord["targetType"]) =>
        TYPE_LABELS[value] || value,
    },
    { title: "目标摘要", dataIndex: "targetSummary", ellipsis: true },
    {
      title: "目标作者",
      dataIndex: "targetAuthorName",
      width: 130,
      render: value => value || "已不存在",
    },
    {
      title: "原因",
      dataIndex: "reasonCode",
      width: 140,
      render: value => <Tag>{REASON_LABELS[value] || value}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 110,
      render: value =>
        value === -1 ? (
          <Badge status="processing" text="待处理" />
        ) : value === 0 ? (
          <Badge status="success" text="已处理" />
        ) : (
          <Badge status="default" text="已驳回" />
        ),
    },
    {
      title: "举报时间",
      dataIndex: "createdAt",
      width: 190,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: "操作",
      key: "action",
      width: 80,
      render: (_, record) => (
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined />}
          onClick={async () => {
            try {
              const result = await loadDetail(signal =>
                getReport(record.id, signal),
              );
              if (!result) return;
              if (result.code !== 0)
                throw new Error(result.msg || "详情加载失败");
              setSelected(result.data);
              form.setFieldsValue({
                decision: "RESOLVE",
                action:
                  record.targetType === "USER"
                    ? "DISABLE_USER"
                    : "REMOVE_CONTENT",
              });
            } catch (error: unknown) {
              message.error(getErrorMessage(error, "详情加载失败"));
            }
          }}
          aria-label="查看举报详情"
          title="查看详情"
        />
      ),
    },
  ];

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">举报管理</h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-gray-400">
          核查社区举报并记录下架、禁用或驳回结论。
        </p>
      </div>
      <section className="rounded-3xl border border-gray-50 bg-white p-5 shadow-sm">
        <header className="mb-4 flex justify-between">
          <Form
            form={filterForm}
            layout="inline"
            initialValues={initialValues}
            onValuesChange={(_, values) => handleSearch(values)}
          >
            <Form.Item name="status">
              <Select
                allowClear
                placeholder="状态"
                style={{ width: 120 }}
                options={[
                  { value: "-1", label: "待处理" },
                  { value: "0", label: "已处理" },
                  { value: "1", label: "已驳回" },
                ]}
              />
            </Form.Item>
            <Form.Item name="targetType">
              <Select
                allowClear
                placeholder="对象"
                style={{ width: 120 }}
                options={[
                  { value: "POST", label: "帖子" },
                  { value: "COMMENT", label: "评论" },
                  { value: "USER", label: "用户" },
                ]}
              />
            </Form.Item>
            <Form.Item name="reasonCode">
              <Select
                allowClear
                placeholder="原因"
                style={{ width: 150 }}
                options={Object.entries(REASON_LABELS).map(
                  ([value, label]) => ({ value, label }),
                )}
              />
            </Form.Item>
            <Form.Item name="createdAtRange">
              <RangePicker />
            </Form.Item>
          </Form>
          <Button onClick={handleReset}>重置</Button>
        </header>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data.list}
          loading={{ spinning: navigation.state === "loading", delay: 150 }}
          scroll={{ x: 1000, y: "calc(100vh - 386px)" }}
          pagination={{
            current: data.page,
            pageSize: data.size,
            total: data.total,
            showSizeChanger: true,
            pageSizeOptions: ["20", "40"],
            onChange: onPageChange,
          }}
        />
      </section>
      <Modal
        width={680}
        title="举报详情"
        open={selected !== null}
        okText={selected?.status === -1 ? "确认处理" : "关闭"}
        cancelText="取消"
        confirmLoading={handling}
        onOk={
          selected?.status === -1
            ? submit
            : () => {
                cancelDetail();
                setSelected(null);
              }
        }
        onCancel={() => {
          cancelDetail();
          setSelected(null);
          form.resetFields();
        }}
      >
        {selected && (
          <>
            <Descriptions
              bordered
              size="small"
              column={2}
              className="mt-5"
              items={[
                {
                  key: "reporter",
                  label: "举报人",
                  children: selected.reporterName,
                },
                {
                  key: "target",
                  label: "举报对象",
                  children:
                    TYPE_LABELS[selected.targetType] || selected.targetType,
                },
                {
                  key: "author",
                  label: "目标作者",
                  children: selected.targetAuthorName || "已不存在",
                },
                {
                  key: "reason",
                  label: "举报原因",
                  children:
                    REASON_LABELS[selected.reasonCode] || selected.reasonCode,
                },
                {
                  key: "summary",
                  label: "目标摘要",
                  span: 2,
                  children: selected.targetSummary,
                },
                {
                  key: "description",
                  label: "补充说明",
                  span: 2,
                  children: selected.description || "无",
                },
                ...(selected.status !== -1
                  ? [
                      {
                        key: "action",
                        label: "处置动作",
                        children: selected.action
                          ? ACTION_LABELS[selected.action] || selected.action
                          : "-",
                      },
                      {
                        key: "reviewer",
                        label: "处理人",
                        children: selected.reviewerName || "-",
                      },
                      {
                        key: "note",
                        label: "处理备注",
                        span: 2,
                        children: selected.reviewNote || "无",
                      },
                    ]
                  : []),
              ]}
            />
            {selected.status === -1 && (
              <Form form={form} layout="vertical" className="mt-5">
                <Form.Item
                  name="decision"
                  label="处理结论"
                  rules={[{ required: true }]}
                >
                  <Select
                    options={[
                      { value: "RESOLVE", label: "举报成立" },
                      { value: "DISMISS", label: "举报不成立" },
                    ]}
                  />
                </Form.Item>
                <Form.Item noStyle dependencies={["decision"]}>
                  {({ getFieldValue }) =>
                    getFieldValue("decision") === "RESOLVE" && (
                      <Form.Item
                        name="action"
                        label="处置动作"
                        rules={[{ required: true, message: "请选择处置动作" }]}
                      >
                        <Select
                          options={[
                            { value: "NONE", label: "仅记录，不执行处置" },
                            ...(selected.targetType !== "USER"
                              ? [{ value: "REMOVE_CONTENT", label: "下架内容" }]
                              : []),
                            {
                              value: "DISABLE_USER",
                              label: "禁用目标作者账号",
                            },
                          ]}
                        />
                      </Form.Item>
                    )
                  }
                </Form.Item>
                <Form.Item name="reviewNote" label="处理备注">
                  <Input.TextArea
                    rows={4}
                    maxLength={500}
                    showCount
                    placeholder="记录判断依据或补充说明"
                  />
                </Form.Item>
              </Form>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
