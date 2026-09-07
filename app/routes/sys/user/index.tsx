import {
  Button,
  Form,
  Input,
  Table,
  DatePicker,
  Flex,
  Select,
  Popconfirm,
  Space,
  type TableProps,
  message,
  Tag,
} from "antd";
import { useLoaderData, useNavigation, useRevalidator } from "react-router";
import { getUsers, removeUser } from "~/services/user";
import { useMemo, useState } from "react";
const { RangePicker } = DatePicker;
import type { Dayjs } from "dayjs";
import UserAddDrawer from "~/routes/sys/user/components/UserAddDrawer";
import UserEditDrawer from "~/routes/sys/user/components/UserEditDrawer";
import {
  DeleteTwoTone,
  EditOutlined,
  ExclamationCircleFilled,
} from "@ant-design/icons";
import { useTableQuery } from "~/hooks/useTableQuery";
import RoleCards from "~/routes/sys/user/components/RoleCards";
import { getCachedRoles } from "~/services/roleCache";
import type { Route } from "./+types";
import type { ConsoleUser } from "~/types/api";
import { requireApiSuccess } from "~/services/http";
import { formatDateTime } from "~/utils/date";

interface FormValues extends Record<string, unknown> {
  keyword?: string;
  roles?: number[];
  createdAtRange?: [Dayjs, Dayjs];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);

  const [rolesRes, usersRes] = await Promise.all([
    getCachedRoles(),
    getUsers(url.search),
  ]);
  if (usersRes.code !== 0) {
    throw new Response(usersRes.msg || "用户列表加载失败", { status: 500 });
  }
  return {
    roles: rolesRes,
    users: requireApiSuccess(usersRes),
  };
}

export default function User() {
  const [modalStatus, setModalStatus] = useState({
    userAdd: false,
    userEdit: false,
  });
  const [currentRecord, setCurrentRecord] = useState<ConsoleUser | null>(null);
  const revalidator = useRevalidator();
  const { users, roles } = useLoaderData<typeof clientLoader>();
  const roleNames = useMemo(
    () => Object.fromEntries(roles.map(role => [role.id, role.roleName])),
    [roles],
  );
  const columns: TableProps<ConsoleUser>["columns"] = [
    {
      title: "用户名",
      dataIndex: "username",
    },
    {
      title: "邮箱",
      dataIndex: "email",
    },
    {
      title: "所属角色",
      dataIndex: "roleName",
      render: (_, record) => (
        <Flex gap="small" align="center" wrap>
          {record.roles.map(item => (
            <Tag key={item}>{roleNames[item] ?? `角色 ${item}`}</Tag>
          ))}
        </Flex>
      ),
    },
    {
      title: "最后登录IP",
      dataIndex: "lastLoginIp",
    },
    {
      title: "最后登录时间",
      dataIndex: "lastLoginAt",
      render: (value: string | null) => formatDateTime(value),
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            onClick={() => {
              setCurrentRecord(record);
              setModalStatus(pre => ({ ...pre, userEdit: true }));
            }}
            type="text"
            icon={<EditOutlined />}
            aria-label={`编辑用户 ${record.username}`}
            title="编辑"
          />
          <Popconfirm
            placement="topRight"
            icon={<ExclamationCircleFilled style={{ color: "#ff4d4f" }} />}
            title="确认删除该用户？"
            description="删除后该用户将无法登录，且关联数据可能受影响。"
            onConfirm={async () => {
              const { code, msg } = await removeUser(record);
              if (code === 0) {
                message.success(msg);
                await revalidator.revalidate();
              } else {
                message.error(msg);
              }
            }}
            okText="确认"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              type="text"
              icon={<DeleteTwoTone twoToneColor="#ff4d4f" />}
              aria-label={`删除用户 ${record.username}`}
              title="删除"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];
  const navigation = useNavigation();
  const { form, initialValues, handleSearch, handleReset, onPageChange } =
    useTableQuery<FormValues>({
      pageSize: users.size,
      dateFields: ["createdAtRange"],
      numberFields: ["roles"],
      arrayFields: ["roles"],
    });

  return (
    <>
      <RoleCards roles={roles} />
      <div className="mb-6 mt-6">
        <h2 className="text-xl font-bold text-gray-800">用户</h2>
        <p className="text-sm text-gray-400 mt-1.5 leading-relaxed max-w-3xl">
          管理成员档案及其在项目中的身份。
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
              <Input allowClear placeholder="用户名" />
            </Form.Item>
            <Form.Item name="roles">
              <Select
                allowClear
                maxTagCount={1}
                placeholder="所属角色"
                style={{ width: 200 }}
                fieldNames={{
                  value: "id",
                  label: "roleName",
                }}
                mode="multiple"
                options={roles}
              />
            </Form.Item>
            <Form.Item name="createdAtRange">
              <RangePicker />
            </Form.Item>
          </Form>
          <Flex gap="small" wrap>
            <Button onClick={handleReset}>重置</Button>
            <Button
              type="primary"
              onClick={() => setModalStatus(pre => ({ ...pre, userAdd: true }))}
            >
              新增
            </Button>
            <UserAddDrawer
              roles={roles}
              open={modalStatus.userAdd}
              onClose={() =>
                setModalStatus(pre => ({ ...pre, userAdd: false }))
              }
            />
            <UserEditDrawer
              roles={roles}
              initialValues={currentRecord}
              open={modalStatus.userEdit}
              onClose={() => {
                setModalStatus(pre => ({ ...pre, userEdit: false }));
                setCurrentRecord(null);
              }}
            />
          </Flex>
        </header>
        <Table<ConsoleUser>
          loading={{
            spinning: navigation.state === "loading",
            delay: 150,
            size: "large",
          }}
          columns={columns}
          dataSource={users.list}
          rowKey="id"
          pagination={{
            current: users.page,
            pageSize: users.size,
            total: users.total,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20"],
            showQuickJumper: true,
            onChange: (p, ps) => onPageChange(p, ps),
          }}
        />
      </section>
    </>
  );
}
