import type { Route } from "./+types";
import {
  Badge,
  Button,
  DatePicker,
  Flex,
  Form,
  Input,
  Select,
  Table,
  type TableProps,
} from "antd";
import { useTableQuery } from "~/hooks/useTableQuery";
import { useLoaderData, useNavigation } from "react-router";
import { getLogs } from "~/services/log";
import { useState } from "react";
import LogDetailsDrawer from "~/routes/sys/log/components/LogDetailsDrawer";
import { EyeOutlined } from "@ant-design/icons";
import type { OperationLog } from "~/types/api";
import { requireApiSuccess } from "~/services/http";
import { formatDateTime } from "~/utils/date";

interface LogQueryForm extends Record<string, unknown> {
  keyword?: string;
  status?: string;
  createdAtRange?: unknown[];
}

const { RangePicker } = DatePicker;

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const result = await getLogs(url.search);
  if (result.code !== 0) {
    throw new Response(result.msg || "日志列表加载失败", { status: 500 });
  }
  return requireApiSuccess(result);
}

export default function Index() {
  const data = useLoaderData<typeof clientLoader>();
  const columns: TableProps<OperationLog>["columns"] = [
    {
      title: "所属功能",
      dataIndex: "module",
    },
    {
      title: "操作类型",
      dataIndex: "action",
    },
    {
      title: "路径",
      dataIndex: "requestUrl",
      ellipsis: true,
    },
    {
      title: "方法",
      dataIndex: "requestMethod",
    },
    {
      title: "执行结果",
      dataIndex: "status",
      render: (_, record) =>
        record.status === 0 ? (
          <Badge status="success" text="完成" />
        ) : (
          <Badge status="error" text="失败" />
        ),
    },
    {
      title: "耗时",
      dataIndex: "costTime",
      render: ms => `${ms} ms`,
    },
    {
      title: "时间",
      dataIndex: "createdAt",
      render: (value: string) => formatDateTime(value),
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Button
          onClick={() => {
            setRecord(record);
            setActive(true);
          }}
          size="small"
          type="text"
          icon={<EyeOutlined />}
          aria-label="查看日志详情"
          title="查看详情"
        />
      ),
    },
  ];

  const { form, initialValues, handleSearch, handleReset, onPageChange } =
    useTableQuery<LogQueryForm>({
      pageSize: data.size,
      dateFields: ["createdAtRange"],
    });
  const [active, setActive] = useState(false);
  const [record, setRecord] = useState<OperationLog | null>(null);
  const navigation = useNavigation();
  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">日志</h2>
        <p className="text-sm text-gray-400 mt-1.5 leading-relaxed max-w-3xl">
          审计重要操作行为。
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
            <Form.Item name="keyword">
              <Input allowClear placeholder="搜索任何相关记录..." />
            </Form.Item>
            <Form.Item name="status">
              <Select
                placeholder="状态"
                style={{ width: 120 }}
                allowClear
                options={[
                  { value: "0", label: "完成" },
                  { value: "1", label: "失败" },
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
        <LogDetailsDrawer
          data={record}
          open={active}
          onClose={() => setActive(false)}
        />
      </section>
    </>
  );
}
